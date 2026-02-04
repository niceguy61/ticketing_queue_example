import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Redis 연결 관리 클래스
 * 요구사항 11.1: 대기열 상태를 메모리 또는 데이터베이스에 저장
 */
class RedisConnection {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;
  private readonly url: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor() {
    this.url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.maxRetries = parseInt(process.env.REDIS_MAX_RETRIES || '3', 10);
    this.retryDelayMs = parseInt(process.env.REDIS_RETRY_DELAY_MS || '1000', 10);
  }

  /**
   * Redis 서버에 연결
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      return;
    }

    this.client = createClient({
      url: this.url,
      socket: {
        reconnectStrategy: (retries: number) => {
          if (retries > this.maxRetries) {
            return new Error('Max retries exceeded');
          }
          return this.retryDelayMs * retries;
        }
      }
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('Redis Client Connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      console.log('Redis Client Disconnected');
      this.isConnected = false;
    });

    await this.client.connect();
    this.isConnected = true;
  }

  /**
   * Redis 연결 종료
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Redis 클라이언트 인스턴스 반환
   */
  getClient(): RedisClientType {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client is not connected');
    }
    return this.client;
  }

  /**
   * 연결 상태 확인
   */
  isConnectionHealthy(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * 연결 상태 확인 (비동기)
   */
  async healthCheck(): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      await this.client.ping();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// 싱글톤 인스턴스
const redisConnection = new RedisConnection();

export default redisConnection;
export { RedisConnection };
