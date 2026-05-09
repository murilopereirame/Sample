import { receiptSchema } from './schema.js';
import { roundMoney } from '../utils/numbers.js';

export function normalizeReceipt(parsed, options = {}) {
  const receipt = receiptSchema.parse(parsed);

  const itemsTotal = roundMoney(receipt.items.reduce((sum, item) => sum + item.total_price, 0));
  const subtotal = roundMoney(receipt.subtotal ?? itemsTotal);
  const total = roundMoney(receipt.total ?? subtotal + (receipt.tax ?? 0));
  const discountTotal = roundMoney(receipt.discount_total ?? 0);

  const expectedSubtotal = roundMoney(itemsTotal - discountTotal);
  const totalMismatch = subtotal > 0 ? Math.abs(subtotal - expectedSubtotal) / subtotal > 0.02 : false;

  return {
    ...receipt,
    subtotal,
    total,
    discount_total: discountTotal,
    _validation: {
      total_mismatch: totalMismatch,
      items_count_mismatch: false,
      low_confidence_fields: options.lowConfidenceFields ?? []
    }
  };
}
