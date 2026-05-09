import { describe, expect, it } from 'vitest';
import { normalizeReceipt } from '../../src/normalizer/index.js';

describe('normalizeReceipt', () => {
  it('adds validation metadata', () => {
    const normalized = normalizeReceipt({
      store_name: 'Store',
      store_address: null,
      store_phone: null,
      date: '2024-01-01',
      time: '12:00:00',
      receipt_id: null,
      currency: 'USD',
      items: [{ name: 'A', quantity: 1, unit_price: 1, total_price: 1, category: 'other', discount: 0 }],
      subtotal: 1,
      tax: 0,
      discount_total: 0,
      total: 1,
      payment_method: null,
      loyalty_id: null,
      raw_text: ''
    });

    expect(normalized._validation).toBeTruthy();
    expect(normalized._validation.total_mismatch).toBe(false);
  });
});
