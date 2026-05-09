import { parse } from 'date-fns';
import {
  DATE_PATTERNS,
  LOYALTY_ID_PATTERN,
  PHONE_PATTERN,
  PRICE_PATTERN,
  RECEIPT_ID_PATTERN,
  TIME_PATTERN
} from './regex.js';
import { normalizeOcrLines, simplifyForComparison } from './cleanup.js';
import { parseLocalizedNumber, roundMoney } from '../utils/numbers.js';

const DEFAULT_KEYWORDS = {
  total: ['total', 'amount due', 'summe', 'gesamt', 'zu zahlen'],
  subtotal: ['subtotal', 'sub total', 'net', 'zwischensumme'],
  tax: ['tax', 'vat', 'gst', 'iva', 'mwst', 'ust', 'steuer'],
  discount: ['discount', 'save', 'off', 'rabatt', 'coupon', 'bonus', 'nachlass'],
  payment: ['cash', 'card', 'visa', 'mastercard', 'contactless', 'ec', 'bar', 'karte']
};

const DEFAULT_BRANDS = ['REWE', 'REWE Center', 'Lidl', 'Aldi', 'Edeka', 'Netto', 'Penny', 'Kaufland'];
const DEFAULT_ADDRESS_SUFFIXES = ['str', 'straße', 'strasse', 'weg', 'platz', 'allee'];
const DEFAULT_MARKETING_HINTS = ['payback', 'vorteile', 'punkte', 'punktestand', 'heute', 'coupon'];
const DEFAULT_FOOTER_HINTS = ['batch', 'kasse', 'filiale', 'ust-id'];
const DEFAULT_PRODUCT_HINTS = ['ja!mobil', 'milch', 'brot', 'käse', 'rabatt', 'sm'];
const DATE_FORMATS = ['dd/MM/yyyy', 'MM/dd/yyyy', 'dd.MM.yyyy', 'yyyy-MM-dd'];

export function parseReceiptText(rawText, localeConfig = {}) {
  const parserConfig = buildParserConfig(localeConfig);
  const rawLines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const cleanup = normalizeOcrLines(rawLines, parserConfig);
  const annotatedLines = annotateLines(cleanup.lines, parserConfig);
  const sections = detectSections(annotatedLines, parserConfig);
  const merchant = detectMerchant(sections.header, annotatedLines, parserConfig);
  const dateTime = extractDateTime(annotatedLines, parserConfig.dateFormat);
  const items = extractItems(sections.body, parserConfig);
  const totals = extractTotals(annotatedLines, items, parserConfig);
  const storePhone = extractFirstMatch(rawText, PHONE_PATTERN);
  const receiptId = extractGroup(rawText, RECEIPT_ID_PATTERN, 1);
  const loyaltyId = extractGroup(rawText, LOYALTY_ID_PATTERN, 1);
  const paymentMethod = extractPaymentMethod(annotatedLines, parserConfig.paymentKeywords);

  return {
    store_name: merchant.name,
    store_address: merchant.address,
    store_phone: storePhone,
    date: dateTime.date,
    time: dateTime.time,
    receipt_id: receiptId,
    currency: localeConfig.currency ?? detectCurrency(rawText),
    items,
    subtotal: roundMoney(totals.subtotal ?? 0),
    tax: roundMoney(totals.tax ?? 0),
    discount_total: roundMoney(calculateDiscountTotal(items)),
    total: roundMoney(totals.total ?? 0),
    payment_method: paymentMethod,
    loyalty_id: loyaltyId,
    raw_text: rawText,
    _parser: {
      correctionCount: cleanup.correctionCount,
      appliedCorrections: cleanup.appliedCorrections,
      merchantCandidates: merchant.candidates,
      itemCandidateCount: sections.body.length,
      totalCandidateCount: totals.candidates.length,
      sectionIndices: sections.indices,
      validation: {
        item_sum: roundMoney(items.reduce((sum, item) => sum + item.total_price, 0)),
        total_candidate: roundMoney(totals.total ?? 0),
        date_time_line_index: dateTime.lineIndex
      }
    }
  };
}

function buildParserConfig(localeConfig) {
  return {
    ...localeConfig,
    dateFormat: localeConfig.date_format ?? 'dd/MM/yyyy',
    keywords: mergeKeywords(localeConfig.keywords ?? {}),
    brands: [...new Set([...DEFAULT_BRANDS, ...(localeConfig.brands ?? [])])],
    addressSuffixes: [...new Set([...DEFAULT_ADDRESS_SUFFIXES, ...(localeConfig.address_suffixes ?? [])])],
    marketingHints: [...new Set([...DEFAULT_MARKETING_HINTS, ...(localeConfig.marketing_keywords ?? [])])],
    footerHints: [...new Set([...DEFAULT_FOOTER_HINTS, ...(localeConfig.footer_keywords ?? [])])],
    productHints: [...new Set([...DEFAULT_PRODUCT_HINTS, ...(localeConfig.product_dictionary ?? [])])],
    paymentKeywords: [...new Set([...(localeConfig.keywords?.payment ?? []), ...DEFAULT_KEYWORDS.payment])]
  };
}

function mergeKeywords(localeKeywords) {
  return {
    total: [...DEFAULT_KEYWORDS.total, ...(localeKeywords.total ?? [])],
    subtotal: [...DEFAULT_KEYWORDS.subtotal, ...(localeKeywords.subtotal ?? [])],
    tax: [...DEFAULT_KEYWORDS.tax, ...(localeKeywords.tax ?? [])],
    discount: [...DEFAULT_KEYWORDS.discount, ...(localeKeywords.discount ?? [])],
    payment: [...DEFAULT_KEYWORDS.payment, ...(localeKeywords.payment ?? [])]
  };
}

function annotateLines(lines, config) {
  return lines.map((line) => {
    const prices = extractPrices(line.corrected);
    const lower = line.corrected.toLowerCase();
    const letters = (line.corrected.match(/[a-zA-ZÄÖÜäöüß]/g) ?? []).length;
    const brand = config.brands.find((candidate) => simplifyForComparison(lower).includes(simplifyForComparison(candidate.toLowerCase())));
    const itemScore = scoreItemLine({ ...line, prices, lower, letters }, config);

    return {
      ...line,
      lower,
      letters,
      prices,
      hasPrice: prices.length > 0,
      endsWithPrice: /-?\s*(?:[\$€£¥₹]\s?)?\d{1,6}(?:[.,]\d{2})(?![.,]\d)(?:\s?[\$€£¥₹])?\s*$/i.test(line.corrected),
      looksLikeAddress: looksLikeAddress(line.corrected, config.addressSuffixes),
      isMarketing: containsAny(lower, config.marketingHints),
      isFooter: containsAny(lower, config.footerHints),
      isSummary: containsAny(lower, [...config.keywords.total, ...config.keywords.subtotal, ...config.keywords.tax]),
      isPayment: containsAny(lower, config.paymentKeywords),
      isDiscount: containsAny(lower, config.keywords.discount),
      hasBrand: Boolean(brand),
      brandMatch: brand ?? null,
      isDateTimeLine: containsDateTimeSignal(line.corrected),
      itemScore
    };
  });
}

function detectSections(lines) {
  const bodyCandidates = lines.filter((line) => line.itemScore >= 5);
  const firstItemIndex = bodyCandidates[0]?.index ?? 0;
  const totalLine = [...lines]
    .filter((line) => line.hasPrice)
    .map((line) => ({ line, score: scoreTotalLine(line, [], { keywords: DEFAULT_KEYWORDS }) }))
    .sort((left, right) => right.score - left.score)[0]?.line;
  const totalIndex = totalLine?.index ?? lines.length;

  const header = lines.filter((line) => line.index < firstItemIndex || line.index < Math.min(firstItemIndex, 5));
  const body = lines.filter((line) => line.index >= firstItemIndex && line.index < totalIndex && line.itemScore >= 4);
  const footer = lines.filter((line) => line.index >= totalIndex);

  return {
    header,
    body,
    footer,
    indices: {
      firstItemIndex,
      totalIndex
    }
  };
}

function detectMerchant(headerLines, allLines, config) {
  const candidates = (headerLines.length ? headerLines : allLines.slice(0, 6))
    .map((line) => ({
      line,
      score: scoreMerchantLine(line, config)
    }))
    .sort((left, right) => right.score - left.score);

  const best = candidates.find((candidate) => candidate.score > 0);
  const address = (headerLines.length ? headerLines : allLines)
    .find((line) => line.looksLikeAddress && !line.hasPrice)?.corrected ?? null;

  return {
    name: best ? canonicalizeMerchantName(best.line.corrected, config.brands) : null,
    address,
    candidates: candidates.slice(0, 5).map((candidate) => ({
      line: candidate.line.corrected,
      score: candidate.score
    }))
  };
}

function scoreMerchantLine(line, config) {
  let score = 0;
  if (line.hasBrand) score += 10;
  if (line.index <= 2) score += 2;
  if (line.looksLikeAddress) score -= 8;
  if (line.hasPrice) score -= 4;
  if (line.isMarketing || line.isFooter) score -= 3;
  if (!line.letters) score -= 2;
  if (/\d/.test(line.corrected) && !line.looksLikeAddress) score -= 1;
  if (line.corrected.length >= 3 && line.corrected.length <= 40) score += 1;
  if (config.brands.some((brand) => simplifyForComparison(line.corrected).includes(simplifyForComparison(brand)))) score += 4;
  return score;
}

function canonicalizeMerchantName(line, brands) {
  const normalizedLine = simplifyForComparison(line);
  const matchedBrand = [...brands]
    .sort((left, right) => simplifyForComparison(right).length - simplifyForComparison(left).length)
    .find((brand) => normalizedLine.includes(simplifyForComparison(brand)));
  if (matchedBrand) {
    return matchedBrand;
  }
  return line;
}

function extractDateTime(lines, preferredFormat) {
  for (const line of lines) {
    const date = extractDate(line.corrected, preferredFormat);
    const time = extractTime(line.corrected);
    if (date || time) {
      return {
        date,
        time,
        lineIndex: line.index
      };
    }
  }

  return {
    date: null,
    time: null,
    lineIndex: null
  };
}

function extractItems(lines, config) {
  const items = [];
  const lowerProductHints = new Set(config.productHints.map((hint) => hint.toLowerCase()));

  for (const line of lines) {
    if (line.itemScore < 5 || line.isSummary || line.isMarketing || line.isFooter || line.isDateTimeLine) {
      continue;
    }

    const lastPrice = line.prices[line.prices.length - 1];
    if (!lastPrice) {
      continue;
    }

    const quantityMatch = line.corrected.match(/\b(\d+)\s?[xX]\b|\bqty[:\s]?(\d+)\b|^(\d+)\s+/i);
    const quantity = Number(quantityMatch?.[1] ?? quantityMatch?.[2] ?? quantityMatch?.[3] ?? 1);
    const isDiscount = line.isDiscount || lastPrice.value < 0 || /^\s*-/.test(line.corrected);
    const totalPrice = roundMoney(isDiscount ? -Math.abs(lastPrice.value) : lastPrice.value);
    const itemName = cleanupItemName(line.corrected, lastPrice.text, isDiscount, lowerProductHints, config.keywords.discount);

    if (!itemName) {
      continue;
    }

    const unitPrice = quantity > 0 ? roundMoney(totalPrice / quantity) : totalPrice;
    items.push({
      name: itemName,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      category: classifyCategory(itemName),
      discount: isDiscount ? Math.abs(totalPrice) : 0
    });
  }

  return items;
}

function cleanupItemName(line, priceText, isDiscount, lowerProductHints, discountKeywords) {
  const lastIndex = line.lastIndexOf(priceText);
  const withoutPrice = lastIndex >= 0 ? line.slice(0, lastIndex) : line;
  const withoutQuantity = withoutPrice
    .replace(/\b\d+\s?[xX]\b/i, '')
    .replace(/\bqty[:\s]?\d+\b/i, '')
    .trim();

  const tokens = withoutQuantity.split(/\s+/).filter(Boolean);
  const cleanedTokens = tokens.filter((token, index) => {
    if (/^[A-Z]{1,2}$/.test(token) && index === tokens.length - 1 && !lowerProductHints.has(token.toLowerCase())) {
      return false;
    }
    return true;
  });

  let name = cleanedTokens.join(' ').replace(/\s+%/g, '%').trim();
  if (!name) {
    return null;
  }

  if (isDiscount && !containsAny(name.toLowerCase(), discountKeywords)) {
    const fallbackKeyword = discountKeywords[0] ?? 'rabatt';
    name = `${name} ${fallbackKeyword}`;
  }

  return name;
}

function extractTotals(lines, items, config) {
  const itemSum = roundMoney(items.reduce((sum, item) => sum + item.total_price, 0));
  const subtotalCandidate = extractAmountForKeywords(lines, config.keywords.subtotal);
  const taxCandidate = extractAmountForKeywords(lines, config.keywords.tax);
  const totalCandidates = lines
    .filter((line) => line.hasPrice)
    .map((line) => ({
      line,
      amount: line.prices[line.prices.length - 1].value,
      score: scoreTotalLine(line, items, config)
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  let total = totalCandidates[0]?.amount ?? null;
  if (itemSum !== 0) {
    const matchingCandidate = totalCandidates.find((candidate) => Math.abs(candidate.amount - itemSum) <= 0.05);
    if (matchingCandidate) {
      total = matchingCandidate.amount;
    } else if (total !== null && Math.abs(total - itemSum) > 0.5 && (totalCandidates[0]?.score ?? 0) < 8) {
      total = itemSum;
    }
  }

  const subtotal = subtotalCandidate ?? roundMoney(items.filter((item) => item.total_price > 0).reduce((sum, item) => sum + item.total_price, 0));
  const tax = taxCandidate ?? roundMoney(Math.max(0, (total ?? itemSum) - itemSum));

  return {
    subtotal,
    tax,
    total: total ?? itemSum,
    candidates: totalCandidates.map((candidate) => ({
      line: candidate.line.corrected,
      amount: roundMoney(candidate.amount),
      score: candidate.score
    }))
  };
}

function scoreTotalLine(line, items, config) {
  let score = 0;
  const lower = line.lower;
  const itemSum = roundMoney(items.reduce((sum, item) => sum + item.total_price, 0));
  const amount = line.prices[line.prices.length - 1]?.value ?? 0;

  if (containsAny(lower, config.keywords.total)) score += 8;
  if (containsAny(lower, config.paymentKeywords)) score += 3;
  if (containsAny(lower, config.keywords.subtotal)) score -= 4;
  if (containsAny(lower, config.keywords.tax)) score -= 4;
  if (containsAny(lower, ['payback', 'punkte', 'punktestand', 'batch', 'vorteile'])) score -= 8;
  if (line.itemScore >= 5) score -= 4;
  if (Math.abs(amount - itemSum) <= 0.05) score += 4;
  if (Math.abs(amount - itemSum) <= 0.5) score += 2;
  if (line.endsWithPrice) score += 1;

  return score;
}

function extractPaymentMethod(lines, paymentKeywords) {
  for (const line of lines) {
    const match = paymentKeywords.find((keyword) => line.lower.includes(keyword.toLowerCase()));
    if (match) {
      return match;
    }
  }
  return null;
}

function extractDate(rawText, preferredFormat = 'dd/MM/yyyy') {
  for (const pattern of DATE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const match = regex.exec(rawText);
    if (!match) {
      continue;
    }

    const candidate = match[0];
    const formats = [preferredFormat, ...DATE_FORMATS.filter((format) => format !== preferredFormat)];
    for (const format of formats) {
      const parsed = parse(candidate, format, new Date());
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
      }
    }
  }
  return null;
}

function extractTime(rawText) {
  const match = rawText.match(TIME_PATTERN);
  if (!match) {
    return null;
  }
  const hour = String(Number(match[1])).padStart(2, '0');
  const minute = match[2];
  return `${hour}:${minute}`;
}

function extractAmountForKeywords(lines, keywords) {
  for (const line of lines) {
    if (!keywords.some((keyword) => line.lower.includes(keyword.toLowerCase()))) {
      continue;
    }
    const amount = line.prices[line.prices.length - 1]?.value;
    if (Number.isFinite(amount)) {
      return amount;
    }
  }
  return null;
}

function extractGroup(rawText, regex, groupIndex) {
  const match = rawText.match(regex);
  return match?.[groupIndex] ?? null;
}

function extractFirstMatch(rawText, regex) {
  const match = rawText.match(regex);
  return match?.[0] ?? null;
}

function extractPrices(line) {
  const regex = new RegExp(PRICE_PATTERN.source, 'g');
  const matches = [...line.matchAll(regex)];
  return matches
    .map((match) => ({
      text: match[0].trim(),
      value: parseLocalizedNumber(match[0])
    }))
    .filter((entry) => entry.value !== null);
}

function scoreItemLine(line, config) {
  let score = 0;
  if (line.prices.length) score += 2;
  if (/-?\s*(?:[\$€£¥₹]\s?)?\d{1,6}(?:[.,]\d{2})(?![.,]\d)(?:\s?[\$€£¥₹])?\s*$/i.test(line.corrected)) score += 4;
  if (containsAny(line.lower, config.productHints.map((hint) => hint.toLowerCase()))) score += 2;
  if (containsAny(line.lower, config.keywords.discount)) score += 2;
  if (line.looksLikeAddress) score -= 6;
  if (line.isMarketing || line.isFooter) score -= 6;
  if (line.isSummary) score -= 5;
  if (containsDateTimeSignal(line.corrected)) score -= 5;
  if (line.letters > 2) score += 1;
  return score;
}

function looksLikeAddress(line, suffixes) {
  const lower = line.toLowerCase();
  if (!/\d/.test(lower)) {
    return false;
  }
  return suffixes.some((suffix) => {
    const escaped = escapeRegExp(suffix);
    return new RegExp(`\\b\\w*${escaped}\\.?\\b`, 'i').test(lower);
  });
}

function containsDateTimeSignal(line) {
  return DATE_PATTERNS.some((pattern) => new RegExp(pattern.source).test(line)) || TIME_PATTERN.test(line);
}

function calculateDiscountTotal(items) {
  return roundMoney(items.filter((item) => item.total_price < 0).reduce((sum, item) => sum + Math.abs(item.total_price), 0));
}

function containsAny(value, candidates) {
  return (candidates ?? []).some((candidate) => matchesKeyword(value, candidate));
}

function classifyCategory(name) {
  const lower = name.toLowerCase();
  if (/milch|cheese|käse|yogurt|joghurt|butter/.test(lower)) return 'dairy';
  if (/bread|brot|bun|croissant/.test(lower)) return 'bakery';
  if (/apple|banana|tomato|lettuce|obst|gemüse/.test(lower)) return 'produce';
  if (/chicken|beef|pork|fish|fleisch/.test(lower)) return 'meat';
  if (/mobil|auflad|karte|guthaben/.test(lower)) return 'telecom';
  return 'other';
}

function detectCurrency(rawText) {
  if (rawText.includes('€')) return 'EUR';
  if (rawText.includes('£')) return 'GBP';
  if (rawText.includes('¥')) return 'JPY';
  if (rawText.includes('₹')) return 'INR';
  if (rawText.includes('$')) return 'USD';
  return 'USD';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesKeyword(value, candidate) {
  const normalizedCandidate = candidate.toLowerCase().trim();
  if (!normalizedCandidate) {
    return false;
  }
  if (normalizedCandidate.includes(' ')) {
    return value.includes(normalizedCandidate);
  }
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedCandidate)}([^a-z0-9]|$)`, 'i').test(value);
}
