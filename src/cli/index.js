#!/usr/bin/env node
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { Command } from 'commander';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import { processReceiptFile } from '../pipeline/processReceipt.js';
import { BatchProcessor } from '../batch/queue.js';
import { listInputFiles, toBaseName, writeJsonFile } from '../utils/file.js';

const program = new Command();

program
  .name('receipt-processor')
  .description('Offline receipt processing system')
  .version('1.0.0');

program
  .command('process')
  .argument('<file>', 'Receipt file (JPG, PNG, PDF)')
  .option('--locale <locale>', 'Locale code', 'en-US')
  .option('--pretty', 'Pretty print output', true)
  .action(async (file, options) => {
    const result = await processReceiptFile(path.resolve(file), options);
    process.stdout.write(`${JSON.stringify(result, null, options.pretty ? 2 : 0)}\n`);
  });

program
  .command('batch')
  .argument('<input>', 'Input file or directory')
  .option('--output <dir>', 'Output directory', './output')
  .option('--locale <locale>', 'Locale code', 'en-US')
  .option('--max-concurrent <n>', 'Max worker threads', (v) => Number(v), undefined)
  .action(async (input, options) => {
    const files = await listInputFiles(path.resolve(input));
    await fs.mkdir(path.resolve(options.output), { recursive: true });

    const processor = new BatchProcessor({
      maxConcurrent: options.maxConcurrent
    });

    const bar = new cliProgress.SingleBar({
      format: 'Batch |{bar}| {percentage}% || {value}/{total} files'
    }, cliProgress.Presets.shades_classic);

    bar.start(files.length, 0);
    processor.on('progress', ({ done }) => bar.update(done));

    const results = await processor.process(files, { locale: options.locale });
    bar.stop();

    for (const entry of results) {
      const base = toBaseName(entry.filePath);
      const outPath = path.resolve(options.output, `${base}.json`);
      await writeJsonFile(outPath, entry.ok ? entry.result : { error: entry.error });
    }

    process.stdout.write(chalk.green(`Processed ${results.length} files\n`));
  });

program
  .command('benchmark')
  .argument('<input>', 'Fixtures directory')
  .option('--ground-truth <file>', 'Ground truth folder', './test/ground-truth')
  .action(async (input, options) => {
    process.stdout.write(chalk.yellow('Use npm run benchmark for metrics output.\n'));
    process.stdout.write(`Input: ${input}, ground truth: ${options.groundTruth}\n`);
  });

program.parseAsync().catch((error) => {
  process.stderr.write(chalk.red(`${error.message}\n`));
  process.exit(1);
});
