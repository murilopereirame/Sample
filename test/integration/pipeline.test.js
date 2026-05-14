import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { preprocessReceipt } from '../../src/preprocessing/index.js';

describe('pipeline integration', () => {
  it('preprocesses fixture image buffer', async () => {
    const fixture = path.resolve('./test/fixtures/sample-receipt.png');
    const result = await preprocessReceipt(fixture, { width: 600 });
    expect(result.image).toBeInstanceOf(Buffer);
    expect(result.image.length).toBeGreaterThan(0);
  });
});
