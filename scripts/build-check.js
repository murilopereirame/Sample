import { promises as fs } from 'node:fs';
import path from 'node:path';

async function checkDirectory(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await checkDirectory(fullPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.js')) {
      await fs.access(fullPath);
    }
  }
}

await checkDirectory(path.resolve('./src'));
console.log('Build check passed.');
