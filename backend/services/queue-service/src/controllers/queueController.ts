import { Request, Response, NextFunction } from 'express';
import { QueueDataStructure } from '../queue/queueDataStructure';
import QueueConfigManager from '../queue/queueConfig';
import { ValidationError, QueueFullError, ConflictError } from '../middleware/errorHandler';
import logger from '../utils/logger';

/**
 * Queue Controller
 * 대기열 API 엔드포인트 핸들러
 */
export class QueueController {
  private queueDS: QueueDataStructure;
  private configManager: QueueConfigManager;

  constructor() {
    this.queueDS = new QueueDataStructure();
    this.configManager = new QueueConfigManager();
  }

  /**
   * 큐 모드 조회 API
   * GET /api/queue/mode
   * 현재 운영 모드 반환 (simple 또는 advanced)
   */
  getQueueMode = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const mode = await this.configManager.getMode();
      res.status(200).json({ mode });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 로비 대기열 진입 API
   * POST /api/queue/lobby/join
   * 요구사항 6-1.1: 사용자를 로비 대기열에 추가
   */
  joinLobby = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.body;

      // 입력 검증
      if (!userId || typeof userId !== 'string') {
        throw new ValidationError('userId is required and must be a string', 'userId');
      }

      // UUID 형식 검증
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        throw new ValidationError('userId must be a valid UUID', 'userId');
      }

      const queueName = 'lobby:queue';

      // 중복 진입 확인
      const isInQueue = await this.queueDS.isUserInQueue(queueName, userId);
      if (isInQueue) {
        throw new ConflictError('User is already in the queue');
      }

      // 용량 확인
      const capacity = await this.configManager.getLobbyCapacity();
      const currentSize = await this.queueDS.getQueueSize(queueName);

      if (currentSize >= capacity) {
        throw new QueueFullError('Lobby queue has reached maximum capacity');
      }

      // 대기열에 추가
      const success = await this.queueDS.addToQueue(queueName, userId);

      if (!success) {
        throw new Error('Failed to add user to queue');
      }

      // 대기 위치 정보 조회
      const positionInfo = await this.queueDS.getQueuePositionInfo(queueName, userId);

      if (!positionInfo) {
        throw new Error('Failed to get queue position');
      }

      // 예상 대기 시간 계산 (초 단위)
      const processingRate = await this.configManager.getProcessingRate();
      const estimatedWaitTime = Math.ceil(positionInfo.position / processingRate) * 60; // 분 단위를 초로 변환

      logger.info('User joined lobby queue', { 
        userId, 
        position: positionInfo.position,
        estimatedWaitTime 
      });

      res.status(200).json({
        queueId: `lobby-${userId}`,
        position: positionInfo.position,
        estimatedWaitTime,
        totalWaiting: positionInfo.totalWaiting
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * 대기열 상태 조회 API
   * GET /api/queue/lobby/status
   * 요구사항 6-1.6: 전체 대기 인원 반환
   */
  getLobbyStatus = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const queueName = 'lobby:queue';
      const totalWaiting = await this.queueDS.getQueueSize(queueName);
      const capacity = await this.configManager.getLobbyCapacity();

      res.status(200).json({
        totalWaiting,
        capacity,
        available: capacity - totalWaiting,
        currentServing: 0 // Simple 모드에서는 항상 0
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * 대기열 위치 조회 API
   * GET /api/queue/lobby/position/:userId
   * 요구사항 6-1.6: 사용자별 대기 위치 반환
   */
  getLobbyPosition = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;

      // 입력 검증
      if (!userId) {
        throw new ValidationError('userId is required', 'userId');
      }

      const queueName = 'lobby:queue';

      // 대기열에 있는지 확인
      const isInQueue = await this.queueDS.isUserInQueue(queueName, userId);
      if (!isInQueue) {
        throw new ValidationError('User is not in the queue', 'userId');
      }

      // 위치 정보 조회
      const positionInfo = await this.queueDS.getQueuePositionInfo(queueName, userId);

      if (!positionInfo) {
        throw new Error('Failed to get queue position');
      }

      // 예상 대기 시간 계산
      const processingRate = await this.configManager.getProcessingRate();
      const estimatedWaitTime = Math.ceil(positionInfo.position / processingRate) * 60;

      res.status(200).json({
        position: positionInfo.position,
        estimatedWaitTime,
        totalWaiting: positionInfo.totalWaiting
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * 대기열 이탈 API
   * DELETE /api/queue/lobby/leave/:userId
   * 요구사항 6.3: 대기열에서 사용자 제거
   */
  leaveLobby = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;

      // 입력 검증
      if (!userId) {
        throw new ValidationError('userId is required', 'userId');
      }

      const queueName = 'lobby:queue';

      // 대기열에 있는지 확인
      const isInQueue = await this.queueDS.isUserInQueue(queueName, userId);
      if (!isInQueue) {
        throw new ValidationError('User is not in the queue', 'userId');
      }

      // 대기열에서 제거
      const success = await this.queueDS.removeFromQueue(queueName, userId);

      if (!success) {
        throw new Error('Failed to remove user from queue');
      }

      logger.info('User left lobby queue', { userId });

      res.status(200).json({
        success: true,
        message: 'User removed from queue'
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * 티케팅 이벤트 목록 조회 API (Advanced 모드)
   * GET /api/queue/events
   * 요구사항 6-2.5, 6-2.7: 이벤트 목록 저장/조회, 이벤트별 용량 관리
   */
  getEvents = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 운영 모드 확인
      const mode = await this.configManager.getMode();
      if (mode !== 'advanced') {
        throw new ValidationError('Events are only available in advanced mode', 'mode');
      }

      // 모든 티켓 이벤트 조회
      const ticketEvents = await this.configManager.getAllTicketEvents();

      // 각 이벤트의 현재 대기 인원 조회
      const events = await Promise.all(
        Object.entries(ticketEvents).map(async ([eventId, config]) => {
          const queueName = `ticket:queue:${eventId}`;
          const currentWaiting = await this.queueDS.getQueueSize(queueName);

          return {
            eventId,
            name: config.name,
            capacity: config.capacity,
            available: Math.max(0, config.capacity - currentWaiting),
            currentWaiting,
            processingRate: config.processingRate
          };
        })
      );

      logger.info('Retrieved ticket events', { count: events.length });

      res.status(200).json({
        events
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * 티케팅별 대기열 진입 API (Advanced 모드)
   * POST /api/queue/ticket/join
   * 요구사항 6-2.4: 이벤트 ID 검증, 티켓 대기열 추가
   */
  joinTicketQueue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, eventId } = req.body;

      // 입력 검증
      if (!userId || typeof userId !== 'string') {
        throw new ValidationError('userId is required and must be a string', 'userId');
      }

      if (!eventId || typeof eventId !== 'string') {
        throw new ValidationError('eventId is required and must be a string', 'eventId');
      }

      // UUID 형식 검증
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        throw new ValidationError('userId must be a valid UUID', 'userId');
      }

      // 운영 모드 확인
      const mode = await this.configManager.getMode();
      if (mode !== 'advanced') {
        throw new ValidationError('Ticket queues are only available in advanced mode', 'mode');
      }

      // 이벤트 존재 여부 확인
      const eventConfig = await this.configManager.getTicketEvent(eventId);
      if (!eventConfig) {
        throw new ValidationError('Event not found', 'eventId');
      }

      const queueName = `ticket:queue:${eventId}`;

      // 중복 진입 확인
      const isInQueue = await this.queueDS.isUserInQueue(queueName, userId);
      if (isInQueue) {
        throw new ConflictError('User is already in this ticket queue');
      }

      // 용량 확인
      const currentSize = await this.queueDS.getQueueSize(queueName);
      if (currentSize >= eventConfig.capacity) {
        throw new QueueFullError(`Ticket queue for event ${eventId} has reached maximum capacity`);
      }

      // 대기열에 추가
      const success = await this.queueDS.addToQueue(queueName, userId, eventId);

      if (!success) {
        throw new Error('Failed to add user to ticket queue');
      }

      // 대기 위치 정보 조회
      const positionInfo = await this.queueDS.getQueuePositionInfo(queueName, userId);

      if (!positionInfo) {
        throw new Error('Failed to get queue position');
      }

      // 예상 대기 시간 계산 (초 단위)
      const estimatedWaitTime = Math.ceil(positionInfo.position / eventConfig.processingRate) * 60;

      logger.info('User joined ticket queue', { 
        userId, 
        eventId,
        position: positionInfo.position,
        estimatedWaitTime 
      });

      res.status(200).json({
        queueId: `ticket-${eventId}-${userId}`,
        eventId,
        eventName: eventConfig.name,
        position: positionInfo.position,
        estimatedWaitTime,
        totalWaiting: positionInfo.totalWaiting
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * 티케팅별 대기열 상태 조회 API (Advanced 모드)
   * GET /api/queue/ticket/:eventId/status
   * 요구사항 6-2.10: 이벤트별 대기 인원 반환
   */
  getTicketQueueStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { eventId } = req.params;

      // 입력 검증
      if (!eventId) {
        throw new ValidationError('eventId is required', 'eventId');
      }

      // 운영 모드 확인
      const mode = await this.configManager.getMode();
      if (mode !== 'advanced') {
        throw new ValidationError('Ticket queues are only available in advanced mode', 'mode');
      }

      // 이벤트 존재 여부 확인
      const eventConfig = await this.configManager.getTicketEvent(eventId);
      if (!eventConfig) {
        throw new ValidationError('Event not found', 'eventId');
      }

      const queueName = `ticket:queue:${eventId}`;
      const totalWaiting = await this.queueDS.getQueueSize(queueName);

      res.status(200).json({
        eventId,
        eventName: eventConfig.name,
        totalWaiting,
        capacity: eventConfig.capacity,
        available: Math.max(0, eventConfig.capacity - totalWaiting),
        currentServing: 0 // 현재는 0으로 반환
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * 로비에서 티켓 대기열로 이동 API (Advanced 모드)
   * POST /api/queue/lobby/move-to-ticket
   * 요구사항 6-2.3, 6-2.4: 로비 대기열에서 제거, 티켓 대기열에 추가
   */
  moveToTicketQueue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, eventId } = req.body;

      // 입력 검증
      if (!userId || typeof userId !== 'string') {
        throw new ValidationError('userId is required and must be a string', 'userId');
      }

      if (!eventId || typeof eventId !== 'string') {
        throw new ValidationError('eventId is required and must be a string', 'eventId');
      }

      // UUID 형식 검증
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        throw new ValidationError('userId must be a valid UUID', 'userId');
      }

      // 운영 모드 확인
      const mode = await this.configManager.getMode();
      if (mode !== 'advanced') {
        throw new ValidationError('Queue movement is only available in advanced mode', 'mode');
      }

      // 이벤트 존재 여부 확인
      const eventConfig = await this.configManager.getTicketEvent(eventId);
      if (!eventConfig) {
        throw new ValidationError('Event not found', 'eventId');
      }

      const lobbyQueueName = 'lobby:queue';
      const ticketQueueName = `ticket:queue:${eventId}`;

      // 로비 대기열에 있는지 확인
      const isInLobby = await this.queueDS.isUserInQueue(lobbyQueueName, userId);
      if (!isInLobby) {
        throw new ValidationError('User is not in the lobby queue', 'userId');
      }

      // 티켓 대기열에 이미 있는지 확인
      const isInTicketQueue = await this.queueDS.isUserInQueue(ticketQueueName, userId);
      if (isInTicketQueue) {
        throw new ConflictError('User is already in this ticket queue');
      }

      // 티켓 대기열 용량 확인
      const currentSize = await this.queueDS.getQueueSize(ticketQueueName);
      if (currentSize >= eventConfig.capacity) {
        throw new QueueFullError(`Ticket queue for event ${eventId} has reached maximum capacity`);
      }

      // 1. 로비 대기열에서 제거
      const removedFromLobby = await this.queueDS.removeFromQueue(lobbyQueueName, userId);
      if (!removedFromLobby) {
        throw new Error('Failed to remove user from lobby queue');
      }

      // 2. 티켓 대기열에 추가
      try {
        const addedToTicket = await this.queueDS.addToQueue(ticketQueueName, userId, eventId);
        if (!addedToTicket) {
          // 롤백: 로비 대기열에 다시 추가
          await this.queueDS.addToQueue(lobbyQueueName, userId);
          throw new Error('Failed to add user to ticket queue');
        }
      } catch (error) {
        // 롤백: 로비 대기열에 다시 추가
        await this.queueDS.addToQueue(lobbyQueueName, userId);
        throw error;
      }

      // 대기 위치 정보 조회
      const positionInfo = await this.queueDS.getQueuePositionInfo(ticketQueueName, userId);

      if (!positionInfo) {
        throw new Error('Failed to get queue position');
      }

      // 예상 대기 시간 계산 (초 단위)
      const estimatedWaitTime = Math.ceil(positionInfo.position / eventConfig.processingRate) * 60;

      logger.info('User moved from lobby to ticket queue', { 
        userId, 
        eventId,
        position: positionInfo.position 
      });

      res.status(200).json({
        success: true,
        queueId: `ticket-${eventId}-${userId}`,
        eventId,
        eventName: eventConfig.name,
        position: positionInfo.position,
        estimatedWaitTime,
        totalWaiting: positionInfo.totalWaiting,
        message: 'Successfully moved to ticket queue'
      });

    } catch (error) {
      next(error);
    }
  };
}

export default QueueController;
