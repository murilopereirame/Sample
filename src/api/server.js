import path from 'node:path';
import { promises as fs } from 'node:fs';
import crypto from 'node:crypto';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { processReceiptFile } from '../pipeline/processReceipt.js';
import { BatchProcessor } from '../batch/queue.js';

export async function createServer(options = {}) {
  const app = Fastify({ logger: false, bodyLimit: options.bodyLimit ?? 20 * 1024 * 1024 });
  const jobs = new Map();

  await app.register(multipart, {
    attachFieldsToBody: true,
    limits: { fileSize: options.fileSizeLimit ?? 20 * 1024 * 1024 }
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
  });

  app.get('/api/v1/health', async () => ({ status: 'ok', offline: true }));

  app.post('/api/v1/process', async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ error: 'file is required' });
    }

    const tempPath = path.resolve(options.tempDir ?? './tmp', `${Date.now()}-${file.filename}`);
    await fs.mkdir(path.dirname(tempPath), { recursive: true });
    await fs.writeFile(tempPath, await file.toBuffer());

    try {
      const locale = String(request.query.locale ?? 'en-US');
      const result = await processReceiptFile(tempPath, { locale });
      return reply.send(result);
    } finally {
      await fs.rm(tempPath, { force: true });
    }
  });

  app.post('/api/v1/batch', async (request, reply) => {
    const files = [];
    for await (const part of request.parts()) {
      if (part.type !== 'file') continue;
      const tempPath = path.resolve(options.tempDir ?? './tmp', `${Date.now()}-${part.filename}`);
      await fs.mkdir(path.dirname(tempPath), { recursive: true });
      await fs.writeFile(tempPath, await part.toBuffer());
      files.push(tempPath);
    }

    if (!files.length) {
      return reply.code(400).send({ error: 'at least one file is required' });
    }

    const jobId = crypto.randomUUID();
    jobs.set(jobId, { status: 'queued', result: null });

    const processor = new BatchProcessor({ maxConcurrent: options.maxConcurrent });
    processor
      .process(files, { locale: String(request.query.locale ?? 'en-US') })
      .then(async (results) => {
        jobs.set(jobId, { status: 'done', result: results });
        await Promise.all(files.map((file) => fs.rm(file, { force: true })));
      })
      .catch((error) => {
        jobs.set(jobId, { status: 'failed', error: error.message, result: null });
      });

    return reply.code(202).send({ jobId, status: 'queued' });
  });

  app.get('/api/v1/status/:jobId', async (request, reply) => {
    const job = jobs.get(request.params.jobId);
    if (!job) return reply.code(404).send({ error: 'job not found' });
    return reply.send({ status: job.status, error: job.error ?? null });
  });

  app.get('/api/v1/result/:jobId', async (request, reply) => {
    const job = jobs.get(request.params.jobId);
    if (!job) return reply.code(404).send({ error: 'job not found' });
    return reply.send(job);
  });

  app.post('/api/v1/correct/:id', async (request, reply) => {
    return reply.send({ status: 'stored_locally', id: request.params.id, correction: request.body ?? {} });
  });

  return app;
}

async function start() {
  const app = await createServer();
  await app.listen({ host: '127.0.0.1', port: Number(process.env.PORT ?? 3000) });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
