import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../../src/parser/index.js';

describe('parseReceiptText', () => {
  it('extracts key fields and items from a simple receipt', () => {
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
    expect(parsed.items).toHaveLength(2);
    expect(parsed.total).toBe(4.26);
    expect(parsed.time).toBe('14:32');
    expect(parsed.payment_method).toBe('card');
  });

  it('prefers supermarket brand over street-like address and recovers corrected german items', () => {
    const rawText = [
      'Kleiststr 12',
      'REWE Center',
      'SJAHMOBEL SM 300 9,95',
      'daMobil 50 % Rabati -4,97',
      '18.04.2017 19:22 Batch 4225',
      'Ihre REWE PAYBACK Vorteile heute',
      'Zu zahlen 5,98 EUR'
    ].join('\n');

    const parsed = parseReceiptText(rawText, {
      currency: 'EUR',
      date_format: 'dd.MM.yyyy',
      brands: ['REWE', 'REWE Center'],
      address_suffixes: ['str'],
      marketing_keywords: ['payback', 'vorteile'],
      footer_keywords: ['batch'],
      product_dictionary: ['Ja!Mobil', 'Rabatt', 'SM'],
      corrections: {
        SJAHMOBEL: 'Ja!Mobil',
        DAMOBIL: 'Ja!Mobil',
        RABATI: 'Rabatt'
      },
      keywords: {
        total: ['zu zahlen', 'summe'],
        tax: ['mwst'],
        subtotal: ['zwischensumme'],
        discount: ['rabatt'],
        payment: ['eur']
      }
    });

    expect(parsed.store_name).toBe('REWE Center');
    expect(parsed.store_address).toBe('Kleiststr 12');
    expect(parsed.date).toBe('2017-04-18');
    expect(parsed.time).toBe('19:22');
    expect(parsed.total).toBe(5.98);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].name).toBe('Ja!Mobil SM 300');
    expect(parsed.items[0].total_price).toBe(9.95);
    expect(parsed.items[1].name).toBe('Ja!Mobil 50% Rabatt');
    expect(parsed.items[1].total_price).toBe(-4.97);
    expect(parsed.discount_total).toBe(4.97);
  });
});
