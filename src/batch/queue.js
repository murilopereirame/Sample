import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { EventEmitter } from 'node:events';

export class BatchProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxConcurrent = options.maxConcurrent ?? Math.max(1, os.cpus().length - 1);
    this.workerFile = path.resolve(options.workerFile ?? './src/batch/worker.js');
    this.jobs = [];
    this.active = new Map();
    this.results = [];
    this.counter = 0;
    this.resolveDone = null;
    this.options = options;
  }

  async process(files, pipelineOptions = {}) {
    this.jobs = files.map((filePath) => ({ id: ++this.counter, filePath, pipelineOptions }));
    this.results = [];

    return new Promise((resolve) => {
      this.resolveDone = resolve;
      for (let i = 0; i < Math.min(this.maxConcurrent, this.jobs.length); i += 1) {
        this.spawnWorker();
      }
    });
  }

  spawnWorker() {
    const worker = new Worker(this.workerFile, {
      workerData: {
        lang: this.options.lang,
        langPath: this.options.langPath
      }
    });

    worker.on('message', (msg) => {
      if (msg.type !== 'result') return;

      const job = this.active.get(worker.threadId);
      this.active.delete(worker.threadId);

      this.results.push({
        filePath: job.filePath,
        ok: msg.ok,
        result: msg.result,
        error: msg.error
      });

      this.emit('progress', {
        done: this.results.length,
        total: this.jobs.length,
        filePath: job.filePath,
        ok: msg.ok
      });

      this.dispatch(worker);
    });

    worker.on('error', (error) => {
      this.emit('worker_error', error);
      this.dispatch(worker);
    });

    this.dispatch(worker);
  }

  dispatch(worker) {
    const job = this.jobs.shift();

    if (!job) {
      worker.postMessage({ type: 'shutdown' });
      if (this.active.size === 0 && this.jobs.length === 0 && this.resolveDone) {
        this.resolveDone(this.results);
      }
      return;
    }

    this.active.set(worker.threadId, job);
    worker.postMessage({
      type: 'process',
      id: job.id,
      filePath: job.filePath,
      options: job.pipelineOptions
    });
  }
}
