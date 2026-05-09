import { promises as fs } from 'node:fs';
import sharp from 'sharp';
import { detectFileType } from '../utils/file.js';

async function pdfToPlaceholderImage(pdfBuffer) {
  const text = `PDF input detected (${pdfBuffer.length} bytes).\nFor image-based PDFs, render page with pdfjs-dist + canvas adapter in production.`;
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  const svg = `<svg width="2000" height="200"><rect width="100%" height="100%" fill="white"/><text x="20" y="60" font-size="28" fill="black">${escapedText}</text></svg>`;
  return Buffer.from(svg);
}

export async function preprocessReceipt(inputPath, options = {}) {
  const fileType = await detectFileType(inputPath);
  const inputBuffer = await fs.readFile(inputPath);

  let imageBuffer = inputBuffer;
  if (fileType === 'pdf') {
    imageBuffer = await pdfToPlaceholderImage(inputBuffer);
  }

  const width = options.width ?? 2000;
  const blurSigma = options.blurSigma ?? 0.45;
  const threshold = options.threshold ?? 145;

  let processor = sharp(imageBuffer, {
    density: 300,
    failOn: 'none'
  })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .grayscale()
    .normalize()
    .blur(blurSigma)
    .threshold(threshold)
    .png();

  const output = await processor.toBuffer();

  return {
    fileType,
    image: output
  };
}
