import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandlerMiddleware, AppError } from './middleware/errorHandler.js';
import { agentAuthMiddleware } from './middleware/auth.js';
import { businessRateLimiter } from './middleware/rateLimit.js';
import { healthRouter } from './routes/healthRoutes.js';
import { webhookRouter } from './routes/webhookRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { locationRouter } from './routes/locationRoutes.js';
import { catalogRouter } from './routes/catalogRoutes.js';
import { cartRouter } from './routes/cartRoutes.js';
import { checkoutRouter } from './routes/checkoutRoutes.js';
import { orderRouter } from './routes/orderRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(): Express {
  const app = express();

  // Express 4 is chosen for its battle-tested, flexible raw body webhook buffer handling and straightforward static asset routing for the embedded console.
  app.set('trust proxy', 1);

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", config.PUBLIC_BASE_URL, 'http://localhost:*', 'http://127.0.0.1:*'],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS restricted to configured base url and localhost
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const isLocal =
          origin.startsWith('http://localhost:') ||
          origin.startsWith('http://127.0.0.1:') ||
          origin === config.PUBLIC_BASE_URL;
        if (isLocal) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
    })
  );

  // Request ID correlation
  app.use(requestIdMiddleware);

  // Unauthenticated Health and OpenAPI routes
  app.use(healthRouter);

  // Razorpay Webhooks (uses custom raw body parser)
  app.use('/webhooks', webhookRouter);

  // Standard JSON Body Parser for all subsequent routes
  app.use(express.json({ limit: '100kb' }));

  // Admin Routes (protected by x-admin-key)
  app.use('/admin', adminRouter);

  // Business API v1 Routes (Protected by Bearer Token, scopes, and 120 req/min rate limit)
  const businessRouter = express.Router();
  businessRouter.use(businessRateLimiter);
  businessRouter.use(agentAuthMiddleware);

  businessRouter.use('/location', locationRouter);
  businessRouter.use('/catalog', catalogRouter);
  businessRouter.use('/cart', cartRouter);
  businessRouter.use('/checkout', checkoutRouter);
  businessRouter.use('/orders', orderRouter);

  app.use('/v1', businessRouter);

  // Embedded Merchant Console SPA static file serving
  const consoleDistCandidates = [
    path.resolve(__dirname, '../../console/dist'),
    path.resolve(__dirname, '../../../console/dist'),
    path.resolve(process.cwd(), 'console/dist'),
  ];

  const consoleDistPath =
    consoleDistCandidates.find((p) => fs.existsSync(p)) || consoleDistCandidates[0];

  // Serve console static files
  app.use('/console', express.static(consoleDistPath));

  // SPA fallback for /console routes
  app.get('/console*', (_req: Request, res: Response) => {
    const indexPath = path.join(consoleDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>QuickCart Console</title></head>
          <body style="font-family: system-ui, sans-serif; padding: 2rem; text-align: center;">
            <h2>QuickCart Merchant Console</h2>
            <p>Console assets are currently compiling. Please run <code>npm run build:console</code> or check back shortly.</p>
            <p><a href="/health">System Health</a> | <a href="/openapi.json">OpenAPI 3.1 Spec</a></p>
          </body>
        </html>
      `);
    }
  });

  // Redirect root / to /console
  app.get('/', (_req: Request, res: Response) => {
    res.redirect('/console');
  });

  // 404 Fallback
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found.`));
  });

  // Central Error Handler
  app.use(errorHandlerMiddleware);

  return app;
}

