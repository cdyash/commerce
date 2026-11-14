import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { store } from '../store/memoryStore.js';
import { buildOpenApiSpec } from '../openapi/openapiBuilder.js';

export const healthRouter = Router();

const startTime = Date.now();

healthRouter.get('/health', (_req: Request, res: Response): void => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  res.status(200).json({
    status: 'ok',
    uptimeSeconds,
    specVersion: store.specVersion,
    version: '1.0.0',
  });
});

healthRouter.get('/openapi.json', (req: Request, res: Response): void => {
  const spec = buildOpenApiSpec(store.specVersion);
  const specJson = JSON.stringify(spec, null, 2);
  const etag = `"${crypto.createHash('sha256').update(specJson).digest('hex').slice(0, 16)}"`;

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('ETag', etag);

  if (req.header('if-none-match') === etag) {
    res.status(304).end();
    return;
  }

  res.status(200).send(specJson);
});

