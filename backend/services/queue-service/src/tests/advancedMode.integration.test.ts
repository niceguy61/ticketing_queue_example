import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import redisConnection from '../redis/connection';
import { QueueDataStructure } from '../queue/queueDataStructure';
import QueueConfigManager from '../queue/queueConfig';
import { v4 as uuidv4 } from 'uuid';

/**
 * Advanced 모드 통합 테스트
 * 요구사항 6-2.1, 6-2.2, 6-2.3, 6-2.4
 * 
 * Feature: ticketing-queue-system, Task 9.8: Advanced 모드 통합 테스트
 * - 로비 → 이벤트 선택 → 티켓 대기열 플로우
 * - 여러 이벤트 동시 운영 테스트
 */
describe('Advanced Mode Integration Tests', () => {
  let app: any;
  let queueDS: QueueDataStructure;
  let configManager: QueueConfigManager;
  const TEST_PORT = 3098;

  // 테스트용 이벤트 ID
  const EVENT_1_ID = 'concert-2024';
  const EVENT_2_ID = 'sports-2024';
  const EVENT_3_ID = 'theater-2024';

  beforeAll(async () => {
    // Redis 연결
    await redisConnection.connect();

    // Queue Data Structure 초기화
    queueDS = new QueueDataStructure();
    configManager = new QueueConfigManager();

    // Advanced 모드로 설정
    await configManager.saveConfig({
      mode: 'advanced',
      lobbyCapacity: 100,
      processingRate: 10,
      ticketEvents: {
        [EVENT_1_ID]: {
          name: 'Concert 2024',
          capacity: 50,
          processingRate: 5
        },
        [EVENT_2_ID]: {
          name: 'Sports Event 2024',
          capacity: 30,
          processingRate: 3
        },
        [EVENT_3_ID]: {
          name: 'Theater Show 2024',
          capacity: 20,
          processingRate: 2
        }
      }
    });

    // Express 앱 시작
    const { default: App } = await import('../app');
    app = new App();
    app.listen(TEST_PORT);
  });

  afterAll(async () => {
    // 서버 종료
    if (app && app.httpServer && app.httpServer.listening) {
      await app.close();
    }

    // Redis 연결 종료
    await redisConnection.disconnect();
  });

  beforeEach(async () => {
    // 모든 대기열 초기화
    await queueDS.clearQueue('lobby:queue');
    await queueDS.clearQueue(`ticket:queue:${EVENT_1_ID}`);
    await queueDS.clearQueue(`ticket:queue:${EVENT_2_ID}`);
    await queueDS.clearQueue(`ticket:queue:${EVENT_3_ID}`);
    
    // Advanced 모드로 확실히 설정 (모드 전환 테스트 후 복원)
    await configManager.setMode('advanced');
  });

  describe('로비 → 이벤트 선택 → 티켓 대기열 플로우', () => {
    it('should complete full Advanced mode flow for single user', async () => {
      const userId = uuidv4();

      // 1. 로비 대기열 진입
      const joinLobbyResponse = await request(app.app)
        .post('/api/queue/lobby/join')
        .send({ userId });

      expect(joinLobbyResponse.status).toBe(200);
      expect(joinLobbyResponse.body).toHaveProperty('queueId');
      expect(joinLobbyResponse.body).toHaveProperty('position');
      expect(joinLobbyResponse.body.position).toBe(1);

      // 로비 대기열에 있는지 확인
      const isInLobby = await queueDS.isUserInQueue('lobby:queue', userId);
      expect(isInLobby).toBe(true);

      // 2. 이벤트 목록 조회
      const eventsResponse = await request(app.app)
        .get('/api/queue/events');

      expect(eventsResponse.status).toBe(200);
      expect(eventsResponse.body).toHaveProperty('events');
      expect(eventsResponse.body.events).toHaveLength(3);
      
      const event1 = eventsResponse.body.events.find((e: any) => e.eventId === EVENT_1_ID);
      expect(event1).toBeDefined();
      expect(event1.name).toBe('Concert 2024');
      expect(event1.capacity).toBe(50);

      // 3. 로비에서 티켓 대기열로 이동
      const moveResponse = await request(app.app)
        .post('/api/queue/lobby/move-to-ticket')
        .send({ userId, eventId: EVENT_1_ID });

      expect(moveResponse.status).toBe(200);
      expect(moveResponse.body.success).toBe(true);
      expect(moveResponse.body.eventId).toBe(EVENT_1_ID);
      expect(moveResponse.body.position).toBe(1);

      // 로비 대기열에서 제거되었는지 확인
      const stillInLobby = await queueDS.isUserInQueue('lobby:queue', userId);
      expect(stillInLobby).toBe(false);

      // 티켓 대기열에 추가되었는지 확인
      const isInTicketQueue = await queueDS.isUserInQueue(`ticket:queue:${EVENT_1_ID}`, userId);
      expect(isInTicketQueue).toBe(true);

      // 4. 티켓 대기열 상태 조회
      const ticketStatusResponse = await request(app.app)
        .get(`/api/queue/ticket/${EVENT_1_ID}/status`);

      expect(ticketStatusResponse.status).toBe(200);
      expect(ticketStatusResponse.body.totalWaiting).toBe(1);
      expect(ticketStatusResponse.body.eventId).toBe(EVENT_1_ID);
    });

    it('should handle multiple users in Advanced mode flow', async () => {
      const user1 = uuidv4();
      const user2 = uuidv4();
      const user3 = uuidv4();

      // 1. 세 명의 사용자가 로비 대기열에 진입
      await request(app.app)
        .post('/api/queue/lobby/join')
        .send({ userId: user1 });

      await request(app.app)
        .post('/api/queue/lobby/join')
        .send({ userId: user2 });

      await request(app.app)
        .post('/api/queue/lobby/join')
        .send({ userId: user3 });

      // 로비 대기열 크기 확인
      const lobbySize = await queueDS.getQueueSize('lobby:queue');
      expect(lobbySize).toBe(3);

      // 2. 각 사용자가 다른 이벤트를 선택
      await request(app.app)
        .post('/api/queue/lobby/move-to-ticket')
        .send({ userId: user1, eventId: EVENT_1_ID });

      await request(app.app)
        .post('/api/queue/lobby/move-to-ticket')
        .send({ userId: user2, eventId: EVENT_2_ID });

      await request(app.app)
        .post('/api/queue/lobby/move-to-ticket')
        .send({ userId: user3, eventId: EVENT_1_ID });

      // 3. 로비 대기열이 비었는지 확인
      const finalLobbySize = await queueDS.getQueueSize('lobby:queue');
      expect(finalLobbySize).toBe(0);

      // 4. 각 티켓 대기열 크기 확인
      const event1Size = await queueDS.getQueueSize(`ticket:queue:${EVENT_1_ID}`);
      const event2Size = await queueDS.getQueueSize(`ticket:queue:${EVENT_2_ID}`);
      const event3Size = await queueDS.getQueueSize(`ticket:queue:${EVENT_3_ID}`);

      expect(event1Size).toBe(2); // user1, user3
      expect(event2Size).toBe(1); // user2
      expect(event3Size).toBe(0); // 아무도 없음
    });

    it('should maintain FIFO order when moving to ticket queue', async () => {
      const users = [uuidv4(), uuidv4(), uuidv4(), uuidv4()];

      // 1. 순서대로 로비 대기열에 진입
      for (const userId of users) {
        await request(app.app)
          .post('/api/queue/lobby/join')
          .send({ userId });
      }

      // 2. 순서대로 같은 이벤트로 이동
      for (const userId of users) {
        await request(app.app)
          .post('/api/queue/lobby/move-to-ticket')
          .send({ userId, eventId: EVENT_1_ID });
      }

      // 3. 티켓 대기열에서 순서 확인
      const entries = await queueDS.getQueueEntries(`ticket:queue:${EVENT_1_ID}`);
      expect(entries).toHaveLength(4);

      // FIFO 순서 확인
      for (let i = 0; i < users.length; i++) {
        expect(entries[i].userId).toBe(users[i]);
      }
    });
  });

  describe('여러 이벤트 동시 운영 테스트', () => {
    it('should handle multiple events independently', async () => {
      // 각 이벤트에 여러 사용자 추가
      const event1Users = [uuidv4(), uuidv4(), uuidv4()];
      const event2Users = [uuidv4(), uuidv4()];
      const event3Users = [uuidv4(), uuidv4(), uuidv4(), uuidv4()];

      // Event 1에 사용자 추가
      for (const userId of event1Users) {
        await request(app.app)
          .post('/api/queue/ticket/join')
          .send({ userId, eventId: EVENT_1_ID });
      }

      // Event 2에 사용자 추가
      for (const userId of event2Users) {
        await request(app.app)
          .post('/api/queue/ticket/join')
          .send({ userId, eventId: EVENT_2_ID });
      }

      // Event 3에 사용자 추가
      for (const userId of event3Users) {
        await request(app.app)
          .post('/api/queue/ticket/join')
          .send({ userId, eventId: EVENT_3_ID });
      }

      // 각 이벤트의 대기열 크기 확인
      const event1Size = await queueDS.getQueueSize(`ticket:queue:${EVENT_1_ID}`);
      const event2Size = await queueDS.getQueueSize(`ticket:queue:${EVENT_2_ID}`);
      const event3Size = await queueDS.getQueueSize(`ticket:queue:${EVENT_3_ID}`);

      expect(event1Size).toBe(3);
      expect(event2Size).toBe(2);
      expect(event3Size).toBe(4);

      // 각 이벤트의 상태 조회
      const event1Status = await request(app.app)
        .get(`/api/queue/ticket/${EVENT_1_ID}/status`);
      const event2Status = await request(app.app)
        .get(`/api/queue/ticket/${EVENT_2_ID}/status`);
      const event3Status = await request(app.app)
        .get(`/api/queue/ticket/${EVENT_3_ID}/status`);

      expect(event1Status.body.totalWaiting).toBe(3);
      expect(event1Status.body.available).toBe(47); // 50 - 3

      expect(event2Status.body.totalWaiting).toBe(2);
      expect(event2Status.body.available).toBe(28); // 30 - 2

      expect(event3Status.body.totalWaiting).toBe(4);
      expect(event3Status.body.available).toBe(16); // 20 - 4
    });

    it('should maintain independence between event queues', async () => {
      const user1 = uuidv4();
      const user2 = uuidv4();

      // Event 1에 사용자 추가
      await request(app.app)
        .post('/api/queue/ticket/join')
        .send({ userId: user1, eventId: EVENT_1_ID });

      // Event 2에 사용자 추가
      await request(app.app)
        .post('/api/queue/ticket/join')
        .send({ userId: user2, eventId: EVENT_2_ID });

      // Event 1에서 사용자 제거
      await queueDS.removeFromQueue(`ticket:queue:${EVENT_1_ID}`, user1);

      // Event 1 크기 확인
      const event1Size = await queueDS.getQueueSize(`ticket:queue:${EVENT_1_ID}`);
      expect(event1Size).toBe(0);

      // Event 2는 영향받지 않음
      const event2Size = await queueDS.getQueueSize(`ticket:queue:${EVENT_2_ID}`);
      expect(event2Size).toBe(1);

      // Event 2에 사용자가 여전히 있는지 확인
      const isInEvent2 = await queueDS.isUserInQueue(`ticket:queue:${EVENT_2_ID}`, user2);
      expect(isInEvent2).toBe(true);
    });

    it('should handle capacity limits per event independently', async () => {
      // Event 3의 용량은 20
      const users = Array.from({ length: 25 }, () => uuidv4());

      // 처음 20명은 성공
      for (let i = 0; i < 20; i++) {
        const response = await request(app.app)
          .post('/api/queue/ticket/join')
          .send({ userId: users[i], eventId: EVENT_3_ID });

        expect(response.status).toBe(200);
      }

      // 21번째부터는 실패 (용량 초과)
      for (let i = 20; i < 25; i++) {
        const response = await request(app.app)
          .post('/api/queue/ticket/join')
          .send({ userId: users[i], eventId: EVENT_3_ID });

        expect(response.status).toBe(429); // Queue Full
        expect(response.body.error).toContain('Queue Full');
      }

      // Event 3 크기 확인
      const event3Size = await queueDS.getQueueSize(`ticket:queue:${EVENT_3_ID}`);
      expect(event3Size).toBe(20);

      // 다른 이벤트는 여전히 사용 가능
      const newUser = uuidv4();
      const event1Response = await request(app.app)
        .post('/api/queue/ticket/join')
        .send({ userId: newUser, eventId: EVENT_1_ID });

      expect(event1Response.status).toBe(200);
    });

    it('should handle concurrent operations on different events', async () => {
      // 동시에 여러 이벤트에 사용자 추가
      const operations = [
        request(app.app)
          .post('/api/queue/ticket/join')
          .send({ userId: uuidv4(), eventId: EVENT_1_ID }),
        request(app.app)
          .post('/api/queue/ticket/join')
          .send({ userId: uuidv4(), eventId: EVENT_2_ID }),
        request(app.app)
          .post('/api/queue/ticket/join')
          .send({ userId: uuidv4(), eventId: EVENT_3_ID }),
        request(app.app)
          .post('/api/queue/ticket/join')
          .send({ userId: uuidv4(), eventId: EVENT_1_ID }),
        request(app.app)
          .post('/api/queue/ticket/join')
          .send({ userId: uuidv4(), eventId: EVENT_2_ID })
      ];

      const results = await Promise.all(operations);

      // 모든 요청이 성공
      results.forEach(result => {
        expect(result.status).toBe(200);
      });

      // 각 이벤트의 크기 확인
      const event1Size = await queueDS.getQueueSize(`ticket:queue:${EVENT_1_ID}`);
      const event2Size = await queueDS.getQueueSize(`ticket:queue:${EVENT_2_ID}`);
      const event3Size = await queueDS.getQueueSize(`ticket:queue:${EVENT_3_ID}`);

      expect(event1Size).toBe(2);
      expect(event2Size).toBe(2);
      expect(event3Size).toBe(1);
    });
  });

  describe('에러 처리 및 엣지 케이스', () => {
    it('should reject direct ticket queue join in simple mode', async () => {
      // Simple 모드로 변경
      await configManager.setMode('simple');

      const userId = uuidv4();
      const response = await request(app.app)
        .post('/api/queue/ticket/join')
        .send({ userId, eventId: EVENT_1_ID });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('advanced mode');
      
      // beforeEach에서 자동으로 advanced 모드로 복원됨
    });

    it('should reject move to non-existent event', async () => {
      const userId = uuidv4();

      // 로비 대기열에 진입
      await request(app.app)
        .post('/api/queue/lobby/join')
        .send({ userId });

      // 존재하지 않는 이벤트로 이동 시도
      const response = await request(app.app)
        .post('/api/queue/lobby/move-to-ticket')
        .send({ userId, eventId: 'non-existent-event' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('not found');

      // 로비 대기열에 여전히 있는지 확인
      const isInLobby = await queueDS.isUserInQueue('lobby:queue', userId);
      expect(isInLobby).toBe(true);
    });

    it('should reject move when user not in lobby', async () => {
      const userId = uuidv4();

      // 로비에 진입하지 않고 바로 이동 시도
      const response = await request(app.app)
        .post('/api/queue/lobby/move-to-ticket')
        .send({ userId, eventId: EVENT_1_ID });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('not in the lobby');
    });

    it('should reject duplicate join to same ticket queue', async () => {
      const userId = uuidv4();

      // 첫 번째 진입 성공
      const firstResponse = await request(app.app)
        .post('/api/queue/ticket/join')
        .send({ userId, eventId: EVENT_1_ID });

      expect(firstResponse.status).toBe(200);

      // 두 번째 진입 실패 (중복)
      const secondResponse = await request(app.app)
        .post('/api/queue/ticket/join')
        .send({ userId, eventId: EVENT_1_ID });

      expect(secondResponse.status).toBe(409); // Conflict
      expect(secondResponse.body.message).toContain('already in');
    });

    it('should allow user to join different ticket queues', async () => {
      const userId = uuidv4();

      // Event 1에 진입
      const response1 = await request(app.app)
        .post('/api/queue/ticket/join')
        .send({ userId, eventId: EVENT_1_ID });

      expect(response1.status).toBe(200);

      // Event 2에도 진입 가능 (다른 이벤트)
      const response2 = await request(app.app)
        .post('/api/queue/ticket/join')
        .send({ userId, eventId: EVENT_2_ID });

      expect(response2.status).toBe(200);

      // 두 대기열 모두에 있는지 확인
      const isInEvent1 = await queueDS.isUserInQueue(`ticket:queue:${EVENT_1_ID}`, userId);
      const isInEvent2 = await queueDS.isUserInQueue(`ticket:queue:${EVENT_2_ID}`, userId);

      expect(isInEvent1).toBe(true);
      expect(isInEvent2).toBe(true);
    });
  });

  describe('복잡한 시나리오', () => {
    it('should handle mixed lobby and direct ticket queue joins', async () => {
      const lobbyUsers = [uuidv4(), uuidv4()];
      const directUsers = [uuidv4(), uuidv4()];

      // 로비를 통한 진입
      for (const userId of lobbyUsers) {
        await request(app.app)
          .post('/api/queue/lobby/join')
          .send({ userId });
      }

      // 로비에서 티켓 대기열로 이동
      await request(app.app)
        .post('/api/queue/lobby/move-to-ticket')
        .send({ userId: lobbyUsers[0], eventId: EVENT_1_ID });

      await request(app.app)
        .post('/api/queue/lobby/move-to-ticket')
        .send({ userId: lobbyUsers[1], eventId: EVENT_1_ID });

      // 직접 티켓 대기열 진입
      for (const userId of directUsers) {
        await request(app.app)
          .post('/api/queue/ticket/join')
          .send({ userId, eventId: EVENT_1_ID });
      }

      // 티켓 대기열 크기 확인
      const event1Size = await queueDS.getQueueSize(`ticket:queue:${EVENT_1_ID}`);
      expect(event1Size).toBe(4);

      // 순서 확인 (로비 사용자가 먼저)
      const entries = await queueDS.getQueueEntries(`ticket:queue:${EVENT_1_ID}`);
      expect(entries[0].userId).toBe(lobbyUsers[0]);
      expect(entries[1].userId).toBe(lobbyUsers[1]);
    });

    it('should handle event list retrieval with varying queue sizes', async () => {
      // 각 이벤트에 다른 수의 사용자 추가
      const event1Users = Array.from({ length: 10 }, () => uuidv4());
      const event2Users = Array.from({ length: 5 }, () => uuidv4());
      // Event 3는 비워둠

      for (const userId of event1Users) {
        await request(app.app)
          .post('/api/queue/ticket/join')
          .send({ userId, eventId: EVENT_1_ID });
      }

      for (const userId of event2Users) {
        await request(app.app)
          .post('/api/queue/ticket/join')
          .send({ userId, eventId: EVENT_2_ID });
      }

      // 이벤트 목록 조회
      const response = await request(app.app)
        .get('/api/queue/events');

      expect(response.status).toBe(200);
      expect(response.body.events).toHaveLength(3);

      const event1 = response.body.events.find((e: any) => e.eventId === EVENT_1_ID);
      const event2 = response.body.events.find((e: any) => e.eventId === EVENT_2_ID);
      const event3 = response.body.events.find((e: any) => e.eventId === EVENT_3_ID);

      expect(event1.currentWaiting).toBe(10);
      expect(event1.available).toBe(40); // 50 - 10

      expect(event2.currentWaiting).toBe(5);
      expect(event2.available).toBe(25); // 30 - 5

      expect(event3.currentWaiting).toBe(0);
      expect(event3.available).toBe(20); // 20 - 0
    });
  });
});
