export function parseLocalizedNumber(input) {
  if (typeof input !== 'string') {
    return Number.isFinite(input) ? Number(input) : null;
  }

  const cleaned = input.replace(/[^\d,.-]/g, '').trim();
  const trimmed = cleaned.replace(/(?!^)-/g, '');
  if (!trimmed) {
    return null;
  }

  const hasComma = trimmed.includes(',');
  const hasDot = trimmed.includes('.');

  let normalized = trimmed;

  if (hasComma && hasDot) {
    if (trimmed.lastIndexOf(',') > trimmed.lastIndexOf('.')) {
      normalized = trimmed.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = trimmed.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    const commaCount = (trimmed.match(/,/g) ?? []).length;
    const [_integerPart, decimalPart] = trimmed.split(',');
    if (commaCount === 1 && decimalPart?.length === 2) {
      normalized = trimmed.replace(',', '.');
    } else {
      normalized = trimmed.replace(/,/g, '');
    }
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

export function roundMoney(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
