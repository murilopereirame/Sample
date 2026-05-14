import { promises as fs } from 'node:fs';
import path from 'node:path';
import { preprocessReceipt } from '../preprocessing/index.js';
import { createOcrEngine } from '../ocr/index.js';
import { parseReceiptText } from '../parser/index.js';
import { normalizeReceipt } from '../normalizer/index.js';
import { computeConfidence } from '../confidence/index.js';

const localeCache = new Map();

export async function processReceiptFile(filePath, options = {}) {
  const resolvedPath = path.resolve(filePath);
  const localeConfig = await loadLocale(options.locale ?? 'en-US', options.localesPath);

  const preprocessed = await preprocessReceipt(resolvedPath, options.preprocessing);

  const ocr = options.ocrEngine ?? createOcrEngine(options.ocrEngineName ?? 'tesseract', {
    lang: options.lang ?? localeConfig.ocr_lang ?? 'eng',
    langPath: options.langPath ?? './models/tessdata'
  });

  let ocrResult;
  try {
    ocrResult = await ocr.recognize(preprocessed.image);
  } finally {
    if (!options.reuseOcrWorker) {
      await ocr.terminate();
    }
  }

  const parsed = parseReceiptText(ocrResult.text, localeConfig);
  const { confidence, lowConfidenceFields } = computeConfidence(parsed, ocrResult.words);
  const normalized = normalizeReceipt(parsed, { lowConfidenceFields });

  return {
    ...normalized,
    _confidence: confidence,
    _meta: {
      input_file: resolvedPath,
      file_type: preprocessed.fileType
    }
  };
}

async function loadLocale(locale, localesPath = './locales') {
  if (localeCache.has(locale)) {
    return localeCache.get(locale);
  }

  const localeFile = path.resolve(localesPath, `${locale}.json`);

  try {
    const raw = await fs.readFile(localeFile, 'utf8');
    const parsed = JSON.parse(raw);
    localeCache.set(locale, parsed);
    return parsed;
  } catch {
    const fallback = {
      currency: 'USD',
      date_format: 'MM/dd/yyyy',
      keywords: {}
    };
    localeCache.set(locale, fallback);
    return fallback;
  }
}
