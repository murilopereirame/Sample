import { createWorker, PSM } from 'tesseract.js';

export class TesseractReceiptEngine {
  constructor(options = {}) {
    this.options = options;
    this.worker = null;
  }

  async init() {
    if (this.worker) {
      return;
    }

    const lang = this.options.lang ?? 'eng';
    this.worker = await createWorker(lang, 1, {
      langPath: this.options.langPath ?? './models/tessdata',
      logger: () => {},
      errorHandler: () => {}
    });

    await this.worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_COLUMN,
      preserve_interword_spaces: '1'
    });
  }

  async recognize(imageBuffer) {
    await this.init();
    const result = await this.worker.recognize(imageBuffer, {}, { hocr: true });
    return {
      text: result.data.text ?? '',
      hocr: result.data.hocr ?? '',
      words: result.data.words ?? []
    };
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}
