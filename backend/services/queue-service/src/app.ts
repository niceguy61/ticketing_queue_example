import express, { Application } from 'express';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { createServer, Server as HTTPServer } from 'http';
import queueRoutes from './routes/queueRoutes';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import logger from './utils/logger';
import QueueProcessor from './services/queueProcessor';

/**
 * Express 앱 및 Socket.io 서버 설정
 * 요구사항 1.3: Queue Service 기본 구조
 */
export class App {
  public app: Application;
  public httpServer: HTTPServer;
  public io: SocketIOServer;
  public queueProcessor: QueueProcessor | null = null;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'DELETE']
      }
    });

    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeSocketIO();
    this.initializeErrorHandling();
  }

  /**
   * 미들웨어 초기화
   */
  private initializeMiddlewares(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(requestLogger);
  }

  /**
   * 라우트 초기화
   */
  private initializeRoutes(): void {
    // 헬스 체크 엔드포인트
    this.app.get('/health', async (_req, res) => {
      try {
        const redisConnection = (await import('./redis/connection')).default;
        const redisHealthy = await redisConnection.healthCheck();

        const health = {
          status: redisHealthy ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          service: 'queue-service',
          dependencies: {
            redis: redisHealthy ? 'connected' : 'disconnected'
          }
        };

        res.status(redisHealthy ? 200 : 503).json(health);
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          service: 'queue-service',
          error: 'Failed to check health'
        });
      }
    });

    // API 라우트
    this.app.use('/api/queue', queueRoutes);
  }

  /**
   * Socket.io 이벤트 핸들러 초기화
   */
  private initializeSocketIO(): void {
    this.io.on('connection', (socket) => {
      logger.info('Socket.io client connected', { socketId: socket.id });

      // 사용자 ID를 소켓에 연결
      socket.on('queue:join', async (data: { userId: string; mode?: string; eventId?: string }) => {
        const { userId, mode, eventId } = data;
        socket.join(userId); // 사용자별 룸 생성
        logger.info('User joined socket room', { userId, socketId: socket.id, mode, eventId });

        // room join 완료 확인 이벤트 전송
        socket.emit('queue:joined', { userId, success: true });

        // 현재 위치 정보 전송
        if (this.queueProcessor) {
          await this.queueProcessor.broadcastPositionUpdate(userId);
        }
      });

      socket.on('queue:leave', (data: { userId: string }) => {
        const { userId } = data;
        socket.leave(userId);
        logger.info('User left socket room', { userId, socketId: socket.id });
      });

      socket.on('disconnect', (reason) => {
        logger.info('Socket.io client disconnected', { 
          socketId: socket.id, 
          reason 
        });
      });

      socket.on('error', (error) => {
        logger.error('Socket.io error', { 
          socketId: socket.id, 
          error: error.message 
        });
      });
    });
  }

  /**
   * 에러 핸들링 초기화
   */
  private initializeErrorHandling(): void {
    // 404 핸들러 (모든 라우트 이후에 추가)
    this.app.use((_req, res, _next) => {
      res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found',
        statusCode: 404
      });
    });

    // 에러 핸들러 (마지막에 추가)
    this.app.use(errorHandler);
  }

  /**
   * Queue Processor 시작
   */
  async startQueueProcessor(): Promise<void> {
    this.queueProcessor = new QueueProcessor(this.io);
    await this.queueProcessor.start();

    // 주기적으로 대기열 상태 브로드캐스트 (30초마다)
    setInterval(async () => {
      if (this.queueProcessor) {
        await this.queueProcessor.broadcastQueueStatus();
      }
    }, 30000);
  }

  /**
   * 서버 시작
   */
  public listen(port: number): void {
    this.httpServer.listen(port, () => {
      logger.info(`Queue Service listening on port ${port}`);
    });
  }

  /**
   * 서버 종료
   */
  public async close(): Promise<void> {
    // Queue Processor 중지
    if (this.queueProcessor) {
      await this.queueProcessor.stop();
    }

    return new Promise((resolve, reject) => {
      this.io.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.httpServer.close((err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        }
      });
    });
  }
}

export default App;
