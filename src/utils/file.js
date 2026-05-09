import { promises as fs } from 'node:fs';
import path from 'node:path';

const MAGIC_BYTES = {
  jpg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  pdf: [0x25, 0x50, 0x44, 0x46]
};

export async function ensureSafePath(filePath) {
  const resolved = path.resolve(filePath);
  const stat = await fs.stat(resolved);
  if (!stat.isFile()) {
    throw new Error(`Not a file: ${resolved}`);
  }
  return resolved;
}

export async function detectFileType(filePath) {
  const resolved = await ensureSafePath(filePath);
  const fd = await fs.open(resolved, 'r');
  try {
    const header = Buffer.alloc(8);
    await fd.read(header, 0, header.length, 0);

    if (matchesMagic(header, MAGIC_BYTES.jpg)) {
      return 'jpg';
    }
    if (matchesMagic(header, MAGIC_BYTES.png)) {
      return 'png';
    }
    if (matchesMagic(header, MAGIC_BYTES.pdf)) {
      return 'pdf';
    }
    return 'unknown';
  } finally {
    await fd.close();
  }
}

function matchesMagic(buffer, magic) {
  return magic.every((byte, index) => buffer[index] === byte);
}

export async function listInputFiles(inputPath) {
  const resolved = path.resolve(inputPath);
  const stat = await fs.stat(resolved);

  if (stat.isFile()) {
    return [resolved];
  }

  if (!stat.isDirectory()) {
    throw new Error(`Input path is not file or directory: ${resolved}`);
  }

  const entries = await fs.readdir(resolved, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(resolved, entry.name));
}

export async function writeJsonFile(filePath, data, pretty = true) {
  const resolved = path.resolve(filePath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, JSON.stringify(data, null, pretty ? 2 : 0), 'utf8');
}

export function toBaseName(filePath) {
  return path.basename(filePath, path.extname(filePath));
}
