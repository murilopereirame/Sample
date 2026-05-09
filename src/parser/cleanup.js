const DEFAULT_CORRECTIONS = {
  PAYBACX: 'PAYBACK',
  SJAHMOBEL: 'Ja!Mobil',
  RABATI: 'Rabatt',
  DAMOBIL: 'Ja!Mobil',
  JAHMOBIL: 'Ja!Mobil'
};

const DEFAULT_LEXICON = [
  'REWE',
  'REWE Center',
  'Lidl',
  'Aldi',
  'Edeka',
  'Netto',
  'Penny',
  'Kaufland',
  'PAYBACK',
  'Ja!Mobil',
  'Rabatt',
  'SUMME',
  'GESAMT',
  'ZU ZAHLEN'
];

const CONFUSION_MAP = {
  '0': 'O',
  '1': 'I',
  '8': 'B',
  X: 'K',
  H: 'N'
};

export function normalizeOcrLines(rawLines, localeConfig = {}) {
  const corrections = buildCorrections(localeConfig.corrections ?? {});
  const lexicon = buildLexicon(localeConfig, corrections);
  const appliedCorrections = [];

  const lines = rawLines
    .map((line, index) => ({
      index,
      raw: normalizeWhitespace(line),
      corrected: correctLine(normalizeWhitespace(line), corrections, lexicon, appliedCorrections)
    }))
    .filter((line) => line.corrected);

  return {
    lines: lines.map((line) => ({
      ...line,
      upper: line.corrected.toUpperCase(),
      simplified: simplifyForComparison(line.corrected)
    })),
    correctionCount: appliedCorrections.length,
    appliedCorrections
  };
}

export function simplifyForComparison(value) {
  return applyConfusions(stripToken(value)).toUpperCase();
}

export function levenshteinDistance(left, right) {
  const a = left ?? '';
  const b = right ?? '';
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));

  for (let row = 0; row <= a.length; row += 1) matrix[row][0] = row;
  for (let col = 0; col <= b.length; col += 1) matrix[0][col] = col;

  for (let row = 1; row <= a.length; row += 1) {
    for (let col = 1; col <= b.length; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function buildCorrections(localeCorrections) {
  const merged = { ...DEFAULT_CORRECTIONS, ...localeCorrections };
  return Object.fromEntries(Object.entries(merged).map(([key, value]) => [stripToken(key), value]));
}

function buildLexicon(localeConfig, corrections) {
  const brandLexicon = localeConfig.brands ?? [];
  const keywordLexicon = Object.values(localeConfig.keywords ?? {}).flat();
  const productLexicon = localeConfig.product_dictionary ?? [];
  const correctionValues = Object.values(corrections);

  return [...new Set([...DEFAULT_LEXICON, ...brandLexicon, ...keywordLexicon, ...productLexicon, ...correctionValues])]
    .filter(Boolean)
    .map((entry) => ({
      canonical: entry,
      normalized: simplifyForComparison(entry)
    }));
}

function correctLine(line, corrections, lexicon, appliedCorrections) {
  const tokens = line.split(/\s+/).filter(Boolean);
  const corrected = tokens.map((token) => correctToken(token, corrections, lexicon, appliedCorrections));
  return normalizeWhitespace(corrected.join(' '));
}

function correctToken(token, corrections, lexicon, appliedCorrections) {
  const prefixMatch = token.match(/^[^\p{L}\p{N}%!-]+/u)?.[0] ?? '';
  const suffixMatch = token.match(/[^\p{L}\p{N}%!.,:-]+$/u)?.[0] ?? '';
  const core = token.slice(prefixMatch.length, token.length - suffixMatch.length);

  if (!core) {
    return token;
  }

  const normalizedCore = stripToken(core);
  if (!normalizedCore) {
    return token;
  }

  if (corrections[normalizedCore]) {
    const replacement = corrections[normalizedCore];
    appliedCorrections.push({ from: core, to: replacement });
    return `${prefixMatch}${replacement}${suffixMatch}`;
  }

  if (!/[A-ZÄÖÜa-zäöü]/.test(core) || normalizedCore.length < 4) {
    return token;
  }

  const normalizedForFuzzy = simplifyForComparison(core);
  let bestMatch = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of lexicon) {
    const distance = levenshteinDistance(normalizedForFuzzy, candidate.normalized);
    const threshold = candidate.normalized.length >= 8 ? 2 : 1;
    if (distance < bestDistance && distance <= threshold) {
      bestDistance = distance;
      bestMatch = candidate.canonical;
    }
  }

  if (bestMatch && bestMatch !== core) {
    appliedCorrections.push({ from: core, to: bestMatch });
    return `${prefixMatch}${bestMatch}${suffixMatch}`;
  }

  return token;
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripToken(value) {
  return value
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}%]/gu, '')
    .toUpperCase();
}

function applyConfusions(value) {
  return value
    .split('')
    .map((char) => CONFUSION_MAP[char] ?? char)
    .join('');
}
