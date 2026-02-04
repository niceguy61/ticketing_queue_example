import dotenv from 'dotenv';
import app from './app';
import { logger } from './utils/logger';
import { getPool, checkConnection } from './database/connection';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3003;

async function startServer() {
  try {
    // Check database connection
    const isConnected = await checkConnection();
    if (!isConnected) {
      logger.error('Failed to connect to database');
      process.exit(1);
    }
    
    logger.info('Database connection established');
    
    // Start Express server
    app.listen(PORT, () => {
      logger.info(`User Service listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  const pool = getPool();
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  const pool = getPool();
  await pool.end();
  process.exit(0);
});

startServer();
