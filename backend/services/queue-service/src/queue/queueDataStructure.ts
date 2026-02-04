import { RedisClientType } from 'redis';
import redisConnection from '../redis/connection';

/**
 * 대기열 엔트리 인터페이스
 */
export interface QueueEntry {
  userId: string;
  joinedAt: number;
  eventId?: string;
}

/**
 * 대기열 위치 정보
 */
export interface QueuePosition {
  position: number;
  totalWaiting: number;
}

/**
 * Redis Sorted Set을 사용한 대기열 데이터 구조
 * 요구사항 6.3, 6.4: 대기열 생성, 조회, 삭제 기능
 */
export class QueueDataStructure {
  private client: RedisClientType;

  constructor() {
    this.client = redisConnection.getClient();
  }

  /**
   * 대기열에 사용자 추가 (zadd)
   * @param queueName 대기열 이름
   * @param userId 사용자 ID
   * @param eventId 이벤트 ID (선택적, Advanced 모드)
   * @returns 추가 성공 여부
   */
  async addToQueue(
    queueName: string,
    userId: string,
    eventId?: string
  ): Promise<boolean> {
    const joinedAt = Date.now();
    const entry: QueueEntry = {
      userId,
      joinedAt,
      ...(eventId && { eventId })
    };

    // Sorted Set에 추가 (score는 joinedAt으로 FIFO 보장)
    const result = await this.client.zAdd(queueName, {
      score: joinedAt,
      value: JSON.stringify(entry)
    });

    return result !== null;
  }

  /**
   * 대기열에서 사용자 위치 조회 (zrank)
   * @param queueName 대기열 이름
   * @param userId 사용자 ID
   * @returns 대기 위치 (0-based index, 없으면 null)
   */
  async getPosition(queueName: string, userId: string): Promise<number | null> {
    // 모든 엔트리 조회
    const entries = await this.client.zRange(queueName, 0, -1);
    
    // userId로 검색
    for (let i = 0; i < entries.length; i++) {
      const entry: QueueEntry = JSON.parse(entries[i]);
      if (entry.userId === userId) {
        return i; // 0-based index
      }
    }
    
    return null;
  }

  /**
   * 대기열에서 사용자 제거 (zrem)
   * @param queueName 대기열 이름
   * @param userId 사용자 ID
   * @returns 제거된 항목 수
   */
  async removeFromQueue(queueName: string, userId: string): Promise<number> {
    // 모든 엔트리 조회
    const entries = await this.client.zRange(queueName, 0, -1);
    
    // userId로 검색하여 제거
    for (const entryStr of entries) {
      const entry: QueueEntry = JSON.parse(entryStr);
      if (entry.userId === userId) {
        const removed = await this.client.zRem(queueName, entryStr);
        return removed;
      }
    }
    
    return 0;
  }

  /**
   * 대기열 크기 조회 (zcard)
   * @param queueName 대기열 이름
   * @returns 대기 중인 사용자 수
   */
  async getQueueSize(queueName: string): Promise<number> {
    return await this.client.zCard(queueName);
  }

  /**
   * 대기열의 다음 사용자 가져오기 (FIFO)
   * @param queueName 대기열 이름
   * @returns 다음 사용자 엔트리 (없으면 null)
   */
  async getNextUser(queueName: string): Promise<QueueEntry | null> {
    // 가장 낮은 score (가장 먼저 들어온) 항목 조회
    const entries = await this.client.zRange(queueName, 0, 0);
    
    if (entries.length === 0) {
      return null;
    }
    
    return JSON.parse(entries[0]);
  }

  /**
   * 대기열에서 다음 사용자 제거하고 반환 (FIFO)
   * Lua 스크립트를 사용하여 원자적 연산 보장
   * @param queueName 대기열 이름
   * @returns 제거된 사용자 엔트리 (없으면 null)
   */
  async popNextUser(queueName: string): Promise<QueueEntry | null> {
    // Lua 스크립트로 ZRANGE + ZREM을 원자적으로 실행
    const luaScript = `
      local entries = redis.call('ZRANGE', KEYS[1], 0, 0)
      if #entries == 0 then
        return nil
      end
      redis.call('ZREM', KEYS[1], entries[1])
      return entries[1]
    `;
    
    try {
      const result = await this.client.eval(luaScript, {
        keys: [queueName],
        arguments: []
      });
      
      if (!result) {
        return null;
      }
      
      return JSON.parse(result as string);
    } catch (error) {
      // Lua 스크립트 실패 시 기존 방식으로 폴백
      const entries = await this.client.zRange(queueName, 0, 0);
      
      if (entries.length === 0) {
        return null;
      }
      
      const entry: QueueEntry = JSON.parse(entries[0]);
      await this.client.zRem(queueName, entries[0]);
      
      return entry;
    }
  }

  /**
   * 대기열의 모든 사용자 조회
   * @param queueName 대기열 이름
   * @param start 시작 인덱스
   * @param end 종료 인덱스
   * @returns 사용자 엔트리 배열
   */
  async getQueueEntries(
    queueName: string,
    start: number = 0,
    end: number = -1
  ): Promise<QueueEntry[]> {
    const entries = await this.client.zRange(queueName, start, end);
    return entries.map(entry => JSON.parse(entry));
  }

  /**
   * 대기열 전체 삭제
   * @param queueName 대기열 이름
   */
  async clearQueue(queueName: string): Promise<void> {
    await this.client.del(queueName);
  }

  /**
   * 사용자가 대기열에 있는지 확인
   * @param queueName 대기열 이름
   * @param userId 사용자 ID
   * @returns 존재 여부
   */
  async isUserInQueue(queueName: string, userId: string): Promise<boolean> {
    const position = await this.getPosition(queueName, userId);
    return position !== null;
  }

  /**
   * 대기열 위치 정보 조회
   * @param queueName 대기열 이름
   * @param userId 사용자 ID
   * @returns 위치 정보
   */
  async getQueuePositionInfo(
    queueName: string,
    userId: string
  ): Promise<QueuePosition | null> {
    const position = await this.getPosition(queueName, userId);
    
    if (position === null) {
      return null;
    }
    
    const totalWaiting = await this.getQueueSize(queueName);
    
    return {
      position: position + 1, // 1-based for user display
      totalWaiting
    };
  }
}

export default QueueDataStructure;
