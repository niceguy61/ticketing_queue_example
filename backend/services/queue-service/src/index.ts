import dotenv from 'dotenv';
import App from './app';
import redisConnection from './redis/connection';
import dbConnection from './database/connection';
import QueueConfigManager from './queue/queueConfig';
import EventSyncService from './services/eventSyncService';
import logger from './utils/logger';

// 환경 변수 로드
dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);

/**
 * Queue Service 메인 진입점
 */
async function main() {
  try {
    // Redis 연결
    logger.info('Connecting to Redis...');
    await redisConnection.connect();
    logger.info('Redis connected successfully');

    // 대기열 설정 초기화
    const configManager = new QueueConfigManager();
    const configExists = await configManager.configExists();
    
    if (!configExists) {
      logger.info('Initializing default queue configuration...');
      await configManager.initializeDefaultConfig();
      logger.info('Queue configuration initialized');
    }

    const config = await configManager.getConfig();
    logger.info('Queue configuration loaded', { config });

    // Advanced 모드일 때 DB에서 이벤트 동기화
    if (config?.mode === 'advanced') {
      try {
        logger.info('Connecting to database for event sync...');
        await dbConnection.connect();
        
        const eventSyncService = new EventSyncService();
        await eventSyncService.syncEventsToRedis();
        
        logger.info('Event sync completed');
      } catch (dbError) {
        logger.warn('Failed to sync events from database, continuing without sync', { error: dbError });
      }
    }

    // Express 앱 시작
    const app = new App();
    app.listen(PORT);

    // Queue Processor 시작
    await app.startQueueProcessor();
    logger.info('Queue processor started');

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');
      
      try {
        await app.close();
        await redisConnection.disconnect();
        if (dbConnection.isConnectedStatus()) {
          await dbConnection.disconnect();
        }
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Failed to start Queue Service', { error });
    process.exit(1);
  }
}

main();
