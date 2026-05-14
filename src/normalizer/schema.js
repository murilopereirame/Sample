import { z } from 'zod';

export const receiptItemSchema = z.object({
  name: z.string().default(''),
  quantity: z.number().min(0).default(1),
  unit_price: z.number().default(0),
  total_price: z.number().default(0),
  category: z.string().default('other'),
  discount: z.number().default(0)
});

export const receiptSchema = z.object({
  store_name: z.string().nullable().default(null),
  store_address: z.string().nullable().default(null),
  store_phone: z.string().nullable().default(null),
  date: z.string().nullable().default(null),
  time: z.string().nullable().default(null),
  receipt_id: z.string().nullable().default(null),
  currency: z.string().default('USD'),
  items: z.array(receiptItemSchema).default([]),
  subtotal: z.number().default(0),
  tax: z.number().default(0),
  discount_total: z.number().default(0),
  total: z.number().default(0),
  payment_method: z.string().nullable().default(null),
  loyalty_id: z.string().nullable().default(null),
  raw_text: z.string().default('')
});
