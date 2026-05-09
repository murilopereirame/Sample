#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const langsArg = args.find((arg) => arg.startsWith('--langs='));
const includeOpenCv = args.includes('--opencv');

const langs = langsArg ? langsArg.split('=')[1].split(',') : ['eng'];

const targetDir = path.resolve('./models/tessdata');
await fs.mkdir(targetDir, { recursive: true });

for (const lang of langs) {
  const filePath = path.resolve(targetDir, `${lang}.traineddata`);
  const placeholder = `Placeholder for ${lang}.traineddata. Download official file before production use.`;
  await fs.writeFile(filePath, placeholder, 'utf8');
  console.log(`Prepared local model placeholder: ${filePath}`);
}

if (includeOpenCv) {
  const openCvDir = path.resolve('./models/opencv');
  await fs.mkdir(openCvDir, { recursive: true });
  await fs.writeFile(path.resolve(openCvDir, 'README.txt'), 'Place OpenCV WASM artifacts here.', 'utf8');
  console.log('Prepared OpenCV model directory.');
}
