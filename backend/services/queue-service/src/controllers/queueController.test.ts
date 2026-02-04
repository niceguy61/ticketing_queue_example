import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Application } from 'express';
import redisConnection from '../redis/connection';
import { errorHandler } from '../middleware/errorHandler';
import QueueConfigManager from '../queue/queueConfig';
import { QueueDataStructure } from '../queue/queueDataStructure';

/**
 * Queue Controller 단위 테스트
 * 요구사항 6-1.1, 6-1.6, 6.3: API 엔드포인트 테스트
 */
describe('Queue Controller', () => {
  let app: Application;
  let configManager: QueueConfigManager;
  let queueDS: QueueDataStructure;

  beforeAll(async () => {
    // Redis 연결
    await redisConnection.connect();

    // Redis 연결 후 라우트 import
    const queueRoutes = (await import('../routes/queueRoutes')).default;

    // Express 앱 설정
    app = express();
    app.use(express.json());
    app.use('/api/queue', queueRoutes);
    app.use(errorHandler);

    configManager = new QueueConfigManager();
    queueDS = new QueueDataStructure();

    // 테스트용 설정 초기화
    await configManager.saveConfig({
      mode: 'simple',
      lobbyCapacity: 100,
      processingRate: 10
    });
  });

  afterAll(async () => {
    await redisConnection.disconnect();
  });

  beforeEach(async () => {
    // 각 테스트 전에 대기열 초기화
    await queueDS.clearQueue('lobby:queue');
  });

  describe('POST /api/queue/lobby/join', () => {
    it('should add user to lobby queue', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .post('/api/queue/lobby/join')
        .send({ userId });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('queueId');
      expect(response.body).toHaveProperty('position');
      expect(response.body).toHaveProperty('estimatedWaitTime');
      expect(response.body.position).toBe(1);
    });

    it('should reject invalid userId format', async () => {
      const response = await request(app)
        .post('/api/queue/lobby/join')
        .send({ userId: 'invalid-id' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });

    it('should reject missing userId', async () => {
      const response = await request(app)
        .post('/api/queue/lobby/join')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });

    it('should reject duplicate user entry', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440001';

      // 첫 번째 진입
      await request(app)
        .post('/api/queue/lobby/join')
        .send({ userId });

      // 중복 진입 시도
      const response = await request(app)
        .post('/api/queue/lobby/join')
        .send({ userId });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Conflict');
    });

    it('should reject when queue is full', async () => {
      // 용량을 1로 설정
      await configManager.setLobbyCapacity(1);

      const userId1 = '550e8400-e29b-41d4-a716-446655440002';
      const userId2 = '550e8400-e29b-41d4-a716-446655440003';

      // 첫 번째 사용자 추가
      await request(app)
        .post('/api/queue/lobby/join')
        .send({ userId: userId1 });

      // 두 번째 사용자 추가 시도 (용량 초과)
      const response = await request(app)
        .post('/api/queue/lobby/join')
        .send({ userId: userId2 });

      expect(response.status).toBe(429);
      expect(response.body.error).toBe('Queue Full');

      // 용량 복원
      await configManager.setLobbyCapacity(100);
    });
  });

  describe('GET /api/queue/lobby/status', () => {
    it('should return queue status', async () => {
      const response = await request(app)
        .get('/api/queue/lobby/status');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalWaiting');
      expect(response.body).toHaveProperty('capacity');
      expect(response.body).toHaveProperty('available');
      expect(response.body).toHaveProperty('currentServing');
    });

    it('should return correct waiting count', async () => {
      // 3명의 사용자 추가
      const userIds = [
        '550e8400-e29b-41d4-a716-446655440004',
        '550e8400-e29b-41d4-a716-446655440005',
        '550e8400-e29b-41d4-a716-446655440006'
      ];

      for (const userId of userIds) {
        await request(app)
          .post('/api/queue/lobby/join')
          .send({ userId });
      }

      const response = await request(app)
        .get('/api/queue/lobby/status');

      expect(response.status).toBe(200);
      expect(response.body.totalWaiting).toBe(3);
    });
  });

  describe('GET /api/queue/lobby/position/:userId', () => {
    it('should return user position in queue', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440007';

      // 사용자 추가
      await request(app)
        .post('/api/queue/lobby/join')
        .send({ userId });

      const response = await request(app)
        .get(`/api/queue/lobby/position/${userId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('position');
      expect(response.body).toHaveProperty('estimatedWaitTime');
      expect(response.body).toHaveProperty('totalWaiting');
    });

    it('should return error for user not in queue', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440008';

      const response = await request(app)
        .get(`/api/queue/lobby/position/${userId}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });
  });

  describe('DELETE /api/queue/lobby/leave/:userId', () => {
    it('should remove user from queue', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440009';

      // 사용자 추가
      await request(app)
        .post('/api/queue/lobby/join')
        .send({ userId });

      // 사용자 제거
      const response = await request(app)
        .delete(`/api/queue/lobby/leave/${userId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // 대기열에서 제거되었는지 확인
      const isInQueue = await queueDS.isUserInQueue('lobby:queue', userId);
      expect(isInQueue).toBe(false);
    });

    it('should return error for user not in queue', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440010';

      const response = await request(app)
        .delete(`/api/queue/lobby/leave/${userId}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });
  });

  describe('FIFO Order', () => {
    it('should maintain FIFO order for multiple users', async () => {
      const userIds = [
        '550e8400-e29b-41d4-a716-446655440011',
        '550e8400-e29b-41d4-a716-446655440012',
        '550e8400-e29b-41d4-a716-446655440013'
      ];

      // 순서대로 추가
      for (const userId of userIds) {
        await request(app)
          .post('/api/queue/lobby/join')
          .send({ userId });
      }

      // 각 사용자의 위치 확인
      for (let i = 0; i < userIds.length; i++) {
        const response = await request(app)
          .get(`/api/queue/lobby/position/${userIds[i]}`);

        expect(response.status).toBe(200);
        expect(response.body.position).toBe(i + 1);
      }
    });
  });
});
