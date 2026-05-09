# Offline Receipt Processor

Fully offline supermarket receipt extraction pipeline in pure JavaScript (Node.js).

## Features

- 100% local processing (no external API calls)
- Input support for JPG, PNG, PDF
- OCR using local `tesseract.js` WASM worker
- Rule-based parser with locale-aware keywords
- Normalized JSON output + confidence and validation metadata
- Batch processing with worker threads
- CLI and local REST API
- Docker support for offline deployment

## Project structure

```text
receipt-processor/
├── src/
├── models/
├── locales/
├── test/
├── docker/
└── scripts/
```

## Installation (one-time online setup)

```bash
npm ci --prefer-offline
node scripts/download-models.js --langs=eng,deu,fra,spa,por
node scripts/verify-offline.js
```

After setup, run fully offline.

## CLI usage

```bash
receipt-processor process ./receipt.jpg --locale en-US
receipt-processor batch ./receipts --output ./output --locale de-DE --max-concurrent 4
npm run benchmark -- ./test/fixtures --report ./benchmark-results.json
```

## Local REST API

```bash
npm run start:api
```

Endpoints:

- `POST /api/v1/process`
- `POST /api/v1/batch`
- `GET /api/v1/status/:jobId`
- `GET /api/v1/result/:jobId`
- `GET /api/v1/health`
- `POST /api/v1/correct/:id`

## JSON output schema

```json
{
  "store_name": "",
  "store_address": "",
  "store_phone": "",
  "date": "",
  "time": "",
  "receipt_id": "",
  "currency": "",
  "items": [
    {
      "name": "",
      "quantity": 1,
      "unit_price": 0,
      "total_price": 0,
      "category": "",
      "discount": 0
    }
  ],
  "subtotal": 0,
  "tax": 0,
  "discount_total": 0,
  "total": 0,
  "payment_method": "",
  "loyalty_id": "",
  "raw_text": ""
}
```

## Docker

```bash
docker build -f docker/Dockerfile -t receipt-processor:offline .
docker run --rm -p 3000:3000 receipt-processor:offline
```

`docker-compose` sets `network_mode: none` for stronger offline isolation.

## Testing

```bash
npm test
```
