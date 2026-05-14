import { receiptSchema } from './schema.js';
import { roundMoney } from '../utils/numbers.js';

export function normalizeReceipt(parsed, options = {}) {
  const receipt = receiptSchema.parse(parsed);
  const parserMeta = options.parserMeta ?? parsed._parser ?? {};

  const itemTotal = roundMoney(receipt.items.reduce((sum, item) => sum + item.total_price, 0));
  const positiveItemTotal = roundMoney(receipt.items.filter((item) => item.total_price > 0).reduce((sum, item) => sum + item.total_price, 0));
  const negativeItemTotal = roundMoney(receipt.items.filter((item) => item.total_price < 0).reduce((sum, item) => sum + Math.abs(item.total_price), 0));

  const subtotal = receipt.subtotal !== 0 ? roundMoney(receipt.subtotal) : positiveItemTotal;
  const discountTotal = receipt.discount_total !== 0 ? roundMoney(receipt.discount_total) : negativeItemTotal;
  const total = receipt.total !== 0 ? roundMoney(receipt.total) : roundMoney(itemTotal);
  const tax = roundMoney(receipt.tax ?? 0);

  const expectedTotal = roundMoney(subtotal - discountTotal + tax);
  const totalMismatch = total !== 0 ? Math.abs(total - expectedTotal) > 0.05 && Math.abs(total - itemTotal) > 0.05 : false;

  return {
    ...receipt,
    subtotal,
    tax,
    total,
    discount_total: discountTotal,
    _validation: {
      total_mismatch: totalMismatch,
      items_count_mismatch: false,
      low_confidence_fields: options.lowConfidenceFields ?? [],
      date_valid: isValidDate(receipt.date),
      time_valid: isValidTime(receipt.time),
      currency_consistent: Boolean(receipt.currency),
      corrected_tokens: parserMeta.correctionCount ?? 0
    }
  };
}

function isValidDate(value) {
  return value ? /^\d{4}-\d{2}-\d{2}$/.test(value) : false;
}

function isValidTime(value) {
  return value ? /^\d{2}:\d{2}(?::\d{2})?$/.test(value) : false;
}
