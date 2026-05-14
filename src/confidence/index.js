export function computeConfidence(parsedReceipt, ocrWords = []) {
  const parserMeta = parsedReceipt._parser ?? {};
  const wordsConfidence = average(ocrWords.map((word) => clamp01((word.confidence ?? 0) / 100))) || 0.75;
  const correctionPenalty = Math.min(0.2, (parserMeta.correctionCount ?? 0) * 0.02);
  const merchantCompetitionPenalty = Math.max(0, ((parserMeta.merchantCandidates?.length ?? 1) - 1) * 0.04);
  const totalCandidatePenalty = Math.max(0, ((parserMeta.totalCandidateCount ?? 1) - 1) * 0.03);

  const confidence = {
    store_name: parsedReceipt.store_name ? clamp01(Math.max(0.55, wordsConfidence + 0.18 - correctionPenalty - merchantCompetitionPenalty)) : 0.2,
    total: parsedReceipt.total !== 0 ? clamp01(0.96 - totalCandidatePenalty + (matchesItemSum(parserMeta) ? 0.03 : -0.1)) : 0.25,
    items: parsedReceipt.items.length > 0 ? clamp01(0.72 + Math.min(parsedReceipt.items.length, 5) * 0.04 - correctionPenalty) : 0.2,
    date: parsedReceipt.date ? clamp01(0.92 - correctionPenalty / 2) : 0.25,
    time: parsedReceipt.time ? clamp01(0.9 - correctionPenalty / 2) : 0.3,
    payment_method: parsedReceipt.payment_method ? clamp01(0.78 - totalCandidatePenalty / 2) : 0.35
  };

  const lowConfidenceFields = Object.entries(confidence)
    .filter(([, value]) => value < 0.4)
    .map(([key]) => key);

  return {
    confidence,
    lowConfidenceFields
  };
}

function matchesItemSum(parserMeta) {
  const validation = parserMeta.validation ?? {};
  return Math.abs((validation.item_sum ?? 0) - (validation.total_candidate ?? 0)) <= 0.05;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
