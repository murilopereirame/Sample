import { TesseractReceiptEngine } from './tesseractEngine.js';

export function createOcrEngine(name = 'tesseract', options = {}) {
  if (name === 'tesseract') {
    return new TesseractReceiptEngine(options);
  }
  throw new Error(`Unsupported OCR engine: ${name}`);
}
