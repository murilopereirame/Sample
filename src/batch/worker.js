import { parentPort, workerData } from 'node:worker_threads';
import { processReceiptFile } from '../pipeline/processReceipt.js';
import { createOcrEngine } from '../ocr/index.js';

const ocr = createOcrEngine('tesseract', {
  lang: workerData?.lang ?? 'eng',
  langPath: workerData?.langPath ?? './models/tessdata'
});

parentPort?.on('message', async (msg) => {
  if (msg.type === 'process') {
    try {
      const result = await processReceiptFile(msg.filePath, {
        ...msg.options,
        ocrEngine: ocr,
        reuseOcrWorker: true
      });
      parentPort?.postMessage({ type: 'result', id: msg.id, ok: true, result });
    } catch (error) {
      parentPort?.postMessage({
        type: 'result',
        id: msg.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (msg.type === 'shutdown') {
    await ocr.terminate();
    parentPort?.close();
  }
});
