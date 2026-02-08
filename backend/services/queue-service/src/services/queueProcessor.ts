import { QueueDataStructure } from '../queue/queueDataStructure';
import QueueConfigManager from '../queue/queueConfig';
import TicketServiceClient from './ticketServiceClient';
import { QueueAdapter } from '../messageQueue/types';
import { QueueAdapterFactory } from '../messageQueue/queueAdapterFactory';
import logger from '../utils/logger';
import { Server as SocketIOServer } from 'socket.io';

/**
 * 대기열 처리 서비스
 * 요구사항 6.5, 6-1.3: FIFO 순서로 대기열 처리
 * 요구사항 6-2.5: 각 이벤트별 독립적인 처리
 */
export class QueueProcessor {
  private queueDS: QueueDataStructure;
  private configManager: QueueConfigManager;
  private ticketClient: TicketServiceClient;
  private messageQueue: QueueAdapter;
  private io: SocketIOServer;
  private isProcessing: boolean = false;
  private processingIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(io: SocketIOServer) {
    this.queueDS = new QueueDataStructure();
    this.configManager = new QueueConfigManager();
    this.ticketClient = new TicketServiceClient();
    this.messageQueue = QueueAdapterFactory.create();
    this.io = io;
  }

  /**
   * 대기열 처리 시작
   */
  async start(): Promise<void> {
    if (this.isProcessing) {
      logger.warn('Queue processor is already running');
      return;
    }

    this.isProcessing = true;
    logger.info('Starting queue processor...');

    // Message Queue 구독 시작
    await this.subscribeToTicketIssueQueue();

    // 운영 모드 확인
    const mode = await this.configManager.getMode();

    if (mode === 'simple') {
      // Simple 모드: 로비 대기열만 처리
      await this.startLobbyQueueProcessing();
    } else {
      // Advanced 모드: 로비 + 티켓 대기열 처리
      await this.startLobbyQueueProcessing();
      await this.startTicketQueuesProcessing();
    }

    logger.info('Queue processor started', { mode });
  }

  /**
   * 대기열 처리 중지
   */
  async stop(): Promise<void> {
    if (!this.isProcessing) {
      return;
    }

    this.isProcessing = false;

    // 모든 처리 인터벌 중지
    for (const [queueName, interval] of this.processingIntervals.entries()) {
      clearInterval(interval);
      logger.info('Stopped processing interval', { queueName });
    }
    this.processingIntervals.clear();

    await this.messageQueue.disconnect();

    logger.info('Queue processor stopped');
  }

  /**
   * 로비 대기열 처리 시작
   */
  private async startLobbyQueueProcessing(): Promise<void> {
    const queueName = 'lobby:queue';
    const processingRate = await this.configManager.getProcessingRate();
    const intervalMs = Math.floor(60000 / processingRate);

    const interval = setInterval(async () => {
      await this.processNextUser(queueName);
    }, intervalMs);

    this.processingIntervals.set(queueName, interval);

    logger.info('Started lobby queue processing', { intervalMs, processingRate });
  }

  /**
   * 티켓 대기열들 처리 시작 (Advanced 모드)
   * 요구사항 6-2.5: 각 이벤트별 독립적인 처리
   */
  private async startTicketQueuesProcessing(): Promise<void> {
    const ticketEvents = await this.configManager.getAllTicketEvents();

    for (const [eventId, eventConfig] of Object.entries(ticketEvents)) {
      const queueName = `ticket:queue:${eventId}`;
      const intervalMs = Math.floor(60000 / eventConfig.processingRate);

      const interval = setInterval(async () => {
        await this.processNextUser(queueName, eventId);
      }, intervalMs);

      this.processingIntervals.set(queueName, interval);

      logger.info('Started ticket queue processing', { 
        eventId, 
        queueName,
        intervalMs, 
        processingRate: eventConfig.processingRate 
      });
    }
  }

  /**
   * 다음 사용자 처리
   * 요구사항 6.5: FIFO 순서 보장
   * @param queueName 대기열 이름
   * @param eventId 이벤트 ID (티켓 대기열인 경우)
   */
  private async processNextUser(queueName: string, eventId?: string): Promise<void> {
    try {
      // 티켓 대기열인 경우 모니터링을 위한 딜레이 추가 (큐에서 꺼내기 전)
      const isTicketQueue = queueName.startsWith('ticket:queue:');
      const ticketQueueDelay = parseInt(process.env.TICKET_QUEUE_DELAY_MS || '0', 10);
      
      if (isTicketQueue && ticketQueueDelay > 0) {
        logger.info('Applying ticket queue delay for monitoring (before pop)', { 
          queueName,
          delayMs: ticketQueueDelay
        });
        await new Promise(resolve => setTimeout(resolve, ticketQueueDelay));
      }

      // 대기열에서 다음 사용자 원자적으로 가져오기 및 제거
      const nextUser = await this.queueDS.popNextUser(queueName);

      if (!nextUser) {
        // 대기열이 비어있음
        return;
      }

      logger.info('Processing next user from queue', { 
        queueName,
        userId: nextUser.userId,
        eventId: eventId || nextUser.eventId
      });

      const mode = await this.configManager.getMode();

      // Advanced 모드에서 로비 대기열 처리: 이벤트 선택 페이지로 이동
      if (mode === 'advanced' && queueName === 'lobby:queue') {
        // 티켓 발급 없이 이벤트 선택 페이지로 이동 알림
        this.io.to(nextUser.userId).emit('queue:your-turn', {
          // ticket 없이 전송 - 프론트엔드에서 이벤트 선택 페이지로 이동
          message: 'Your turn! Please select an event.'
        });

        logger.info('User moved to event selection (Advanced mode)', { 
          queueName,
          userId: nextUser.userId 
        });
        return;
      }

      // Simple 모드 또는 티켓 대기열: Message Queue에 티켓 발급 이벤트 발행
      await this.messageQueue.publish('ticket-issue-queue', {
        userId: nextUser.userId,
        eventId: eventId || nextUser.eventId,
        timestamp: Date.now()
      });

      logger.info('User moved to ticket issue queue', { 
        queueName,
        userId: nextUser.userId 
      });

    } catch (error) {
      logger.error('Error processing next user', { 
        queueName,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * 티켓 발급 큐 구독
   */
  private async subscribeToTicketIssueQueue(): Promise<void> {
    await this.messageQueue.subscribe('ticket-issue-queue', async (message, ack, nack) => {
      const { userId, eventId, _retryCount = 0 } = message;
      const maxRetries = 3;

      try {
        logger.info('Processing ticket issue request', { userId, eventId, retryCount: _retryCount });

        // 모니터링을 위한 티켓 발급 딜레이 (메시지가 큐에 쌓이는 것을 관찰 가능)
        const ticketIssueDelay = parseInt(process.env.TICKET_ISSUE_DELAY_MS || '0', 10);
        if (ticketIssueDelay > 0) {
          logger.info('Applying ticket issue delay for monitoring', { 
            userId,
            eventId,
            delayMs: ticketIssueDelay
          });
          await new Promise(resolve => setTimeout(resolve, ticketIssueDelay));
        }

        // 이벤트 존재 여부 확인 (eventId가 있는 경우)
        if (eventId) {
          const ticketEvents = await this.configManager.getAllTicketEvents();
          if (!ticketEvents[eventId]) {
            logger.warn('Event not found, discarding message', { userId, eventId });
            
            // 사용자에게 이벤트 없음 알림
            this.io.to(userId).emit('queue:error', {
              message: `선택하신 이벤트를 찾을 수 없습니다. (${eventId})`,
              code: 'EVENT_NOT_FOUND'
            });
            
            // 메시지 처리 완료로 처리 (재시도하지 않음)
            await ack();
            return;
          }
        }

        // 티켓 발급
        const ticket = await this.ticketClient.issueTicket(userId, eventId);

        // Socket.io로 사용자에게 알림
        // 프론트엔드가 { ticket: Ticket } 형태를 기대함
        this.io.to(userId).emit('queue:your-turn', {
          ticket: {
            ticketId: ticket.ticketId,
            userId: ticket.userId,
            expiresAt: ticket.expiresAt,
            eventId: eventId
          }
        });

        // 메시지 확인
        await ack();

        logger.info('Ticket issued and notification sent', { 
          userId, 
          ticketId: ticket.ticketId 
        });

      } catch (error) {
        logger.error('Failed to process ticket issue', { 
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
          eventId,
          retryCount: _retryCount
        });

        // 최대 재시도 횟수 초과 시 메시지 버림 (Dead Letter)
        if (_retryCount >= maxRetries) {
          logger.error('Max retries exceeded, discarding message', { userId, eventId });
          await ack(); // 메시지 제거
          
          // 사용자에게 실패 알림
          this.io.to(userId).emit('queue:error', {
            message: '티켓 발급에 실패했습니다. 다시 시도해주세요.',
            code: 'TICKET_ISSUE_FAILED'
          });
          return;
        }

        // 재시도를 위해 nack (재시도 카운트 증가)
        await nack();
      }
    });

    logger.info('Subscribed to ticket-issue-queue');
  }

  /**
   * 대기열 상태 브로드캐스트
   */
  async broadcastQueueStatus(): Promise<void> {
    try {
      const mode = await this.configManager.getMode();

      // 로비 대기열 상태
      const lobbyQueueName = 'lobby:queue';
      const lobbyTotalWaiting = await this.queueDS.getQueueSize(lobbyQueueName);
      const lobbyCapacity = await this.configManager.getLobbyCapacity();

      this.io.emit('queue:status-update', {
        queueType: 'lobby',
        totalWaiting: lobbyTotalWaiting,
        capacity: lobbyCapacity,
        available: lobbyCapacity - lobbyTotalWaiting,
        currentServing: 0
      });

      // Advanced 모드인 경우 티켓 대기열 상태도 브로드캐스트
      if (mode === 'advanced') {
        const ticketEvents = await this.configManager.getAllTicketEvents();

        for (const [eventId, eventConfig] of Object.entries(ticketEvents)) {
          const queueName = `ticket:queue:${eventId}`;
          const totalWaiting = await this.queueDS.getQueueSize(queueName);

          this.io.emit('queue:status-update', {
            queueType: 'ticket',
            eventId,
            eventName: eventConfig.name,
            totalWaiting,
            capacity: eventConfig.capacity,
            available: Math.max(0, eventConfig.capacity - totalWaiting),
            currentServing: 0
          });
        }
      }

    } catch (error) {
      logger.error('Error broadcasting queue status', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * 사용자별 위치 업데이트 브로드캐스트
   * @param userId 사용자 ID
   * @param queueName 대기열 이름 (선택적, 지정하지 않으면 모든 대기열 확인)
   */
  async broadcastPositionUpdate(userId: string, queueName?: string): Promise<void> {
    try {
      // 특정 대기열이 지정된 경우
      if (queueName) {
        await this.broadcastPositionForQueue(userId, queueName);
        return;
      }

      // 지정되지 않은 경우 로비 대기열 확인
      const lobbyQueueName = 'lobby:queue';
      const isInLobby = await this.queueDS.isUserInQueue(lobbyQueueName, userId);

      if (isInLobby) {
        await this.broadcastPositionForQueue(userId, lobbyQueueName);
        return;
      }

      // Advanced 모드인 경우 티켓 대기열들도 확인
      const mode = await this.configManager.getMode();
      if (mode === 'advanced') {
        const ticketEvents = await this.configManager.getAllTicketEvents();

        for (const eventId of Object.keys(ticketEvents)) {
          const ticketQueueName = `ticket:queue:${eventId}`;
          const isInTicketQueue = await this.queueDS.isUserInQueue(ticketQueueName, userId);

          if (isInTicketQueue) {
            await this.broadcastPositionForQueue(userId, ticketQueueName, eventId);
            return;
          }
        }
      }

    } catch (error) {
      logger.error('Error broadcasting position update', { 
        userId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * 특정 대기열에서 사용자 위치 브로드캐스트
   */
  private async broadcastPositionForQueue(
    userId: string, 
    queueName: string, 
    eventId?: string
  ): Promise<void> {
    const positionInfo = await this.queueDS.getQueuePositionInfo(queueName, userId);

    if (!positionInfo) {
      return;
    }

    let processingRate: number;
    let eventName: string | undefined;

    if (queueName === 'lobby:queue') {
      processingRate = await this.configManager.getProcessingRate();
    } else if (eventId) {
      const eventConfig = await this.configManager.getTicketEvent(eventId);
      processingRate = eventConfig?.processingRate || 10;
      eventName = eventConfig?.name;
    } else {
      processingRate = 10; // 기본값
    }

    const estimatedWaitTime = Math.ceil(positionInfo.position / processingRate) * 60;

    this.io.to(userId).emit('queue:position-update', {
      queueName,
      eventId,
      eventName,
      position: positionInfo.position,
      estimatedWaitTime,
      totalWaiting: positionInfo.totalWaiting
    });
  }
}

export default QueueProcessor;
