import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { runOrderSweeper } from './domain/orders.js';

const app = createApp();

const server = app.listen(config.PORT, () => {
  logger.info(
    {
      port: config.PORT,
      env: config.NODE_ENV,
      specVersion: 'v1',
      devTools: config.DEV_TOOLS,
    },
    `🚀 QuickCart Merchant API listening on http://localhost:${config.PORT}`
  );
  console.info(`🚀 QuickCart Merchant API started on http://localhost:${config.PORT}`);
  console.info(`📖 OpenAPI Document: http://localhost:${config.PORT}/openapi.json`);
  console.info(`💻 Merchant Console: http://localhost:${config.PORT}/console`);
});

// Periodic background sweeper for 15-min order expiry and 20-s fulfillment
const sweeperInterval = setInterval(() => {
  runOrderSweeper();
}, 10 * 1000);

// Graceful shutdown
function handleShutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal. Gracefully closing QuickCart server...');
  clearInterval(sweeperInterval);
  server.close(() => {
    logger.info('HTTP server closed successfully.');
    process.exit(0);
  });

  // Force shutdown if connections do not close in 10s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
