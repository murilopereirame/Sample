import { promises as fs } from 'node:fs';
import path from 'node:path';

const requiredPaths = [
  './models',
  './models/tessdata',
  './locales',
  './src'
];

for (const relPath of requiredPaths) {
  const abs = path.resolve(relPath);
  await fs.access(abs);
  console.log(`OK: ${abs}`);
}

console.log('Offline verification completed.');
