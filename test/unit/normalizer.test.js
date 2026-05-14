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
    expect(normalized._validation.date_valid).toBe(true);
    expect(normalized._validation.time_valid).toBe(true);
  });

  it('handles discount items as negative totals', () => {
    const normalized = normalizeReceipt({
      store_name: 'REWE Center',
      store_address: 'Kleiststr 12',
      store_phone: null,
      date: '2017-04-18',
      time: '19:22',
      receipt_id: null,
      currency: 'EUR',
      items: [
        { name: 'Ja!Mobil SM 300', quantity: 1, unit_price: 9.95, total_price: 9.95, category: 'telecom', discount: 0 },
        { name: 'Ja!Mobil 50% Rabatt', quantity: 1, unit_price: -4.97, total_price: -4.97, category: 'telecom', discount: 4.97 }
      ],
      subtotal: 9.95,
      tax: 1,
      discount_total: 0,
      total: 5.98,
      payment_method: null,
      loyalty_id: null,
      raw_text: ''
    });

    expect(normalized.discount_total).toBe(4.97);
    expect(normalized.total).toBe(5.98);
    expect(normalized._validation.total_mismatch).toBe(false);
  });
});
