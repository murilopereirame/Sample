import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../../src/parser/index.js';

describe('parseReceiptText', () => {
  it('extracts key fields and items', () => {
    const rawText = [
      'My Supermarket',
      '123 Main St',
      'Date: 11/15/2024 14:32',
      '2x MILK 2.18',
      'BREAD 1.79',
      'Subtotal 3.97',
      'Tax 0.29',
      'Total 4.26',
      'Card'
    ].join('\n');

    const parsed = parseReceiptText(rawText, { date_format: 'MM/dd/yyyy' });

    expect(parsed.store_name).toBe('My Supermarket');
    expect(parsed.items.length).toBeGreaterThan(0);
    expect(parsed.total).toBe(4.26);
    expect(parsed.payment_method).toBe('card');
  });
});
