import { RedisClientType } from 'redis';
import redisConnection from '../redis/connection';

/**
 * 대기열 운영 모드
 */
export type QueueMode = 'simple' | 'advanced';

/**
 * 티켓 이벤트 설정
 */
export interface TicketEventConfig {
  name: string;
  capacity: number;
  processingRate: number;
}

/**
 * 대기열 설정 인터페이스
 */
export interface QueueConfig {
  mode: QueueMode;
  lobbyCapacity: number;
  processingRate: number;
  ticketEvents?: Record<string, TicketEventConfig>;
}

/**
 * Redis Hash를 사용한 대기열 설정 관리
 * 요구사항 6.1, 6.2: 운영 모드 설정, 용량 설정
 */
export class QueueConfigManager {
  private client: RedisClientType;
  private readonly configKey = 'queue:config';

  constructor() {
    this.client = redisConnection.getClient();
  }

  /**
   * 대기열 설정 저장
   * @param config 대기열 설정
   */
  async saveConfig(config: QueueConfig): Promise<void> {
    const configData = {
      mode: config.mode,
      lobbyCapacity: config.lobbyCapacity.toString(),
      processingRate: config.processingRate.toString(),
      ticketEvents: config.ticketEvents ? JSON.stringify(config.ticketEvents) : ''
    };

    await this.client.hSet(this.configKey, configData);
  }

  /**
   * 대기열 설정 조회
   * @returns 대기열 설정
   */
  async getConfig(): Promise<QueueConfig | null> {
    const configData = await this.client.hGetAll(this.configKey);

    if (!configData || Object.keys(configData).length === 0) {
      return null;
    }

    const config: QueueConfig = {
      mode: (configData.mode as QueueMode) || 'simple',
      lobbyCapacity: parseInt(configData.lobbyCapacity || '1000', 10),
      processingRate: parseInt(configData.processingRate || '10', 10)
    };

    if (configData.ticketEvents) {
      config.ticketEvents = JSON.parse(configData.ticketEvents);
    }

    return config;
  }

  /**
   * 운영 모드 설정
   * @param mode 운영 모드 (simple/advanced)
   */
  async setMode(mode: QueueMode): Promise<void> {
    await this.client.hSet(this.configKey, 'mode', mode);
  }

  /**
   * 운영 모드 조회
   * @returns 운영 모드
   */
  async getMode(): Promise<QueueMode> {
    const mode = await this.client.hGet(this.configKey, 'mode');
    return (mode as QueueMode) || 'simple';
  }

  /**
   * 로비 대기열 용량 설정
   * @param capacity 최대 용량
   */
  async setLobbyCapacity(capacity: number): Promise<void> {
    await this.client.hSet(this.configKey, 'lobbyCapacity', capacity.toString());
  }

  /**
   * 로비 대기열 용량 조회
   * @returns 최대 용량
   */
  async getLobbyCapacity(): Promise<number> {
    const capacity = await this.client.hGet(this.configKey, 'lobbyCapacity');
    return parseInt(capacity || '1000', 10);
  }

  /**
   * 처리 속도 설정
   * @param rate 초당 처리 인원
   */
  async setProcessingRate(rate: number): Promise<void> {
    await this.client.hSet(this.configKey, 'processingRate', rate.toString());
  }

  /**
   * 처리 속도 조회
   * @returns 초당 처리 인원
   */
  async getProcessingRate(): Promise<number> {
    const rate = await this.client.hGet(this.configKey, 'processingRate');
    return parseInt(rate || '10', 10);
  }

  /**
   * 티켓 이벤트 추가 (Advanced 모드)
   * @param eventId 이벤트 ID
   * @param eventConfig 이벤트 설정
   */
  async addTicketEvent(eventId: string, eventConfig: TicketEventConfig): Promise<void> {
    const config = await this.getConfig();
    
    if (!config) {
      throw new Error('Queue config not initialized');
    }

    if (!config.ticketEvents) {
      config.ticketEvents = {};
    }

    config.ticketEvents[eventId] = eventConfig;
    await this.saveConfig(config);
  }

  /**
   * 티켓 이벤트 제거 (Advanced 모드)
   * @param eventId 이벤트 ID
   */
  async removeTicketEvent(eventId: string): Promise<void> {
    const config = await this.getConfig();
    
    if (!config || !config.ticketEvents) {
      return;
    }

    delete config.ticketEvents[eventId];
    await this.saveConfig(config);
  }

  /**
   * 티켓 이벤트 조회 (Advanced 모드)
   * @param eventId 이벤트 ID
   * @returns 이벤트 설정
   */
  async getTicketEvent(eventId: string): Promise<TicketEventConfig | null> {
    const config = await this.getConfig();
    
    if (!config || !config.ticketEvents) {
      return null;
    }

    return config.ticketEvents[eventId] || null;
  }

  /**
   * 모든 티켓 이벤트 조회 (Advanced 모드)
   * @returns 이벤트 설정 맵
   */
  async getAllTicketEvents(): Promise<Record<string, TicketEventConfig>> {
    const config = await this.getConfig();
    return config?.ticketEvents || {};
  }

  /**
   * 기본 설정으로 초기화
   */
  async initializeDefaultConfig(): Promise<void> {
    const mode = (process.env.QUEUE_MODE as QueueMode) || 'simple';
    const lobbyCapacity = parseInt(process.env.LOBBY_CAPACITY || '1000', 10);
    const processingRate = parseInt(process.env.PROCESSING_RATE || '10', 10);

    const defaultConfig: QueueConfig = {
      mode,
      lobbyCapacity,
      processingRate
    };

    await this.saveConfig(defaultConfig);
  }

  /**
   * 환경 변수 값을 기존 Redis 설정에 동기화
   * 서비스 재기동 시 .env 변경 사항이 반영되도록 함
   */
  async syncFromEnv(): Promise<void> {
    const mode = (process.env.QUEUE_MODE as QueueMode) || 'simple';
    const lobbyCapacity = parseInt(process.env.LOBBY_CAPACITY || '1000', 10);
    const processingRate = parseInt(process.env.PROCESSING_RATE || '10', 10);

    const existing = await this.getConfig();

    const updatedConfig: QueueConfig = {
      mode,
      lobbyCapacity,
      processingRate,
      // 기존 ticketEvents 데이터는 보존
      ticketEvents: existing?.ticketEvents
    };

    await this.saveConfig(updatedConfig);
  }

  /**
   * 설정 삭제
   */
  async clearConfig(): Promise<void> {
    await this.client.del(this.configKey);
  }

  /**
   * 설정 존재 여부 확인
   * @returns 설정 존재 여부
   */
  async configExists(): Promise<boolean> {
    const exists = await this.client.exists(this.configKey);
    return exists === 1;
  }
}

export default QueueConfigManager;
