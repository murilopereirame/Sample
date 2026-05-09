export function computeConfidence(parsedReceipt, ocrWords = []) {
  const wordsConfidence = average(ocrWords.map((w) => clamp01((w.confidence ?? 0) / 100)));

  const confidence = {
    store_name: parsedReceipt.store_name ? Math.max(0.65, wordsConfidence) : 0.2,
    total: parsedReceipt.total > 0 ? 0.99 : 0.3,
    items: parsedReceipt.items.length > 0 ? clamp01(0.6 + Math.min(parsedReceipt.items.length, 10) * 0.03) : 0.2,
    date: parsedReceipt.date ? 1 : 0.3,
    payment_method: parsedReceipt.payment_method ? 0.75 : 0.35
  };

  const lowConfidenceFields = Object.entries(confidence)
    .filter(([, value]) => value < 0.4)
    .map(([key]) => key);

  return {
    confidence,
    lowConfidenceFields
  };
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
