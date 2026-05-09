export const DATE_PATTERNS = [
  /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g,
  /\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/g
];

export const TIME_PATTERN = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s?(AM|PM)?\b/i;

export const PRICE_PATTERN = /(?:[\$€£¥₹]\s?\d{1,6}[.,]\d{2})|(?:\d{1,6}(?:[.,]\d{2})\s?[\$€£¥₹]?)|(?:\d+[.,]\d{2})/g;

export const PHONE_PATTERN = /(?:\+?\d[\d\s\-()]{7,15}\d)/g;

export const RECEIPT_ID_PATTERN = /(?:receipt|trans|order|ref)[:\s#]*([A-Z0-9\-]{4,20})/i;

export const LOYALTY_ID_PATTERN = /(?:loyalty|member|card)[:\s#]*([A-Z0-9\-]{6,20})/i;
