import { parse } from 'date-fns';
import {
  DATE_PATTERNS,
  LOYALTY_ID_PATTERN,
  PHONE_PATTERN,
  PRICE_PATTERN,
  RECEIPT_ID_PATTERN,
  TIME_PATTERN
} from './regex.js';
import { parseLocalizedNumber, roundMoney } from '../utils/numbers.js';

const DEFAULT_KEYWORDS = {
  total: ['total', 'amount due', 'summe', 'gesamt'],
  subtotal: ['subtotal', 'sub total', 'net', 'zwischensumme'],
  tax: ['tax', 'vat', 'gst', 'iva', 'mwst'],
  discount: ['discount', 'save', 'off', 'rabatt'],
  payment: ['cash', 'card', 'visa', 'mastercard', 'contactless']
};

export function parseReceiptText(rawText, localeConfig = {}) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const keywords = mergeKeywords(localeConfig.keywords ?? {});

  const store_name = lines[0] ?? null;
  const store_address = lines.slice(1, 4).join(', ') || null;

  const store_phone = extractFirstMatch(rawText, PHONE_PATTERN);
  const date = extractDate(rawText, localeConfig.date_format);
  const time = extractTime(rawText);
  const receipt_id = extractGroup(rawText, RECEIPT_ID_PATTERN, 1);
  const loyalty_id = extractGroup(rawText, LOYALTY_ID_PATTERN, 1);

  const sections = splitSections(lines, keywords);
  const items = extractItems(sections.body, keywords);

  const subtotal = extractAmountForKeywords(lines, keywords.subtotal);
  const tax = extractAmountForKeywords(lines, keywords.tax);
  const total =
    extractTotal(lines, keywords.total, keywords.subtotal) ??
    pickLargestAmount(lines);

  const discount_total = items.reduce((sum, item) => sum + (item.discount ?? 0), 0);

  const payment_method = extractPaymentMethod(lines, keywords.payment);

  return {
    store_name,
    store_address,
    store_phone,
    date,
    time,
    receipt_id,
    currency: localeConfig.currency ?? detectCurrency(rawText),
    items,
    subtotal: roundMoney(subtotal ?? 0),
    tax: roundMoney(tax ?? 0),
    discount_total: roundMoney(discount_total),
    total: roundMoney(total ?? 0),
    payment_method,
    loyalty_id,
    raw_text: rawText
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

function splitSections(lines, keywords) {
  const body = [];
  let seenPriceLine = false;

  for (const line of lines) {
    if (hasPrice(line)) {
      seenPriceLine = true;
    }

    const lower = line.toLowerCase();
    if (keywords.total.some((k) => lower.includes(k))) {
      continue;
    }

    if (seenPriceLine) {
      body.push(line);
    }
  }

  return { body };
}

function extractItems(lines, keywords) {
  const items = [];

  for (const line of lines) {
    const matches = [...line.matchAll(PRICE_PATTERN)];
    if (!matches.length) {
      continue;
    }

    const rightMost = matches[matches.length - 1][0];
    const totalPrice = parseLocalizedNumber(rightMost);
    if (totalPrice === null) {
      continue;
    }

    const quantityMatch = line.match(/\b(\d+)\s?[xX]\b|\bqty[:\s]?(\d+)\b|^(\d+)\s+/i);
    const quantity = Number(quantityMatch?.[1] ?? quantityMatch?.[2] ?? quantityMatch?.[3] ?? 1);

    let name = line.replace(rightMost, '').trim();
    name = name.replace(/\b\d+\s?[xX]\b/i, '').replace(/\bqty[:\s]?\d+\b/i, '').trim();
    if (!name) {
      continue;
    }

    const discount = keywords.discount.some((k) => line.toLowerCase().includes(k)) || /^-/.test(line)
      ? roundMoney(Math.max(0, -1 * (parseLocalizedNumber(line) ?? 0)))
      : 0;

    const unit_price = quantity > 0 ? roundMoney(totalPrice / quantity) : roundMoney(totalPrice);

    items.push({
      name,
      quantity,
      unit_price,
      total_price: roundMoney(totalPrice),
      category: classifyCategory(name),
      discount
    });
  }

  return items;
}

function extractPaymentMethod(lines, paymentKeywords) {
  for (const line of lines) {
    const lower = line.toLowerCase();
    const match = paymentKeywords.find((keyword) => lower.includes(keyword));
    if (match) {
      return match;
    }
  }
  return null;
}

function hasPrice(line) {
  return /(?:[\$€£¥₹]\s?\d{1,6}[.,]\d{2})|(?:\d{1,6}(?:[.,]\d{2})\s?[\$€£¥₹]?)|(?:\d+[.,]\d{2})/.test(line);
}

function classifyCategory(name) {
  const lower = name.toLowerCase();
  if (/milk|cheese|yogurt|butter/.test(lower)) return 'dairy';
  if (/bread|bun|croissant/.test(lower)) return 'bakery';
  if (/apple|banana|tomato|lettuce/.test(lower)) return 'produce';
  if (/chicken|beef|pork|fish/.test(lower)) return 'meat';
  return 'other';
}

function extractDate(rawText, localeDateFormat = 'dd/MM/yyyy') {
  for (const pattern of DATE_PATTERNS) {
    const match = pattern.exec(rawText);
    if (!match) {
      continue;
    }

    const candidate = match[0];
    const formats = [localeDateFormat, 'dd/MM/yyyy', 'MM/dd/yyyy', 'dd.MM.yyyy', 'yyyy-MM-dd'];
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
  const second = match[3] ? String(Number(match[3])).padStart(2, '0') : '00';
  return `${hour}:${minute}:${second}`;
}

function extractGroup(rawText, regex, groupIndex) {
  const match = rawText.match(regex);
  return match?.[groupIndex] ?? null;
}

function extractFirstMatch(rawText, regex) {
  const match = rawText.match(regex);
  return match?.[0] ?? null;
}

function extractAmountForKeywords(lines, keywords) {
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!keywords.some((k) => lower.includes(k))) {
      continue;
    }

    const prices = [...line.matchAll(PRICE_PATTERN)].map((m) => parseLocalizedNumber(m[0])).filter((v) => v !== null);
    if (prices.length) {
      return prices[prices.length - 1];
    }
  }
  return null;
}

function extractTotal(lines, totalKeywords, subtotalKeywords) {
  for (const line of lines) {
    const lower = line.toLowerCase();
    const hasTotal = totalKeywords.some((k) => lower.includes(k));
    const hasSubtotal = subtotalKeywords.some((k) => lower.includes(k));
    if (!hasTotal || hasSubtotal) {
      continue;
    }
    const prices = [...line.matchAll(PRICE_PATTERN)].map((m) => parseLocalizedNumber(m[0])).filter((v) => v !== null);
    if (prices.length) {
      return prices[prices.length - 1];
    }
  }
  return null;
}

function pickLargestAmount(lines) {
  const all = [];
  for (const line of lines) {
    const prices = [...line.matchAll(PRICE_PATTERN)].map((m) => parseLocalizedNumber(m[0])).filter((v) => v !== null);
    all.push(...prices);
  }
  if (!all.length) {
    return 0;
  }
  return Math.max(...all);
}

function detectCurrency(rawText) {
  if (rawText.includes('€')) return 'EUR';
  if (rawText.includes('£')) return 'GBP';
  if (rawText.includes('¥')) return 'JPY';
  if (rawText.includes('₹')) return 'INR';
  if (rawText.includes('$')) return 'USD';
  return 'USD';
}
