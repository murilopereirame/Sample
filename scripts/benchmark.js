import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { processReceiptFile } from '../src/pipeline/processReceipt.js';
import { listInputFiles, toBaseName, writeJsonFile } from '../src/utils/file.js';

const args = process.argv.slice(2);
const reportIndex = args.indexOf('--report');
const reportPath = reportIndex >= 0 ? args[reportIndex + 1] : './benchmark-results.json';
const fixtureDir = args[0] ? path.resolve(args[0]) : path.resolve('./test/fixtures');

const files = await listInputFiles(fixtureDir);

const results = [];
for (const file of files) {
  const start = performance.now();
  let ok = true;
  let error = null;
  try {
    await processReceiptFile(file);
  } catch (e) {
    ok = false;
    error = e.message;
  }
  const end = performance.now();
  results.push({ file: toBaseName(file), ok, error, ms: Number((end - start).toFixed(2)) });
}

const summary = {
  total_files: results.length,
  success: results.filter((r) => r.ok).length,
  failed: results.filter((r) => !r.ok).length,
  avg_ms: results.length ? Number((results.reduce((s, r) => s + r.ms, 0) / results.length).toFixed(2)) : 0,
  results
};

await writeJsonFile(path.resolve(reportPath), summary, true);
await fs.access(path.resolve(reportPath));
console.log(`Benchmark report written to ${path.resolve(reportPath)}`);
