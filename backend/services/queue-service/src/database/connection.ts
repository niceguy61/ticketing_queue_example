import { Pool, PoolClient } from 'pg';
import logger from '../utils/logger';

/**
 * PostgreSQL 데이터베이스 연결 관리
 */
class DatabaseConnection {
  private pool: Pool | null = null;
  private isConnected = false;

  /**
   * 데이터베이스 연결
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.pool) {
      return;
    }

    const connectionString = process.env.DATABASE_URL || 
      `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'ticketing'}`;

    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // 연결 테스트
    const client = await this.pool.connect();
    client.release();
    
    this.isConnected = true;
    logger.info('Database connected successfully');
  }

  /**
   * 데이터베이스 연결 해제
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      logger.info('Database disconnected');
    }
  }

  /**
   * Pool 인스턴스 반환
   */
  getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    return this.pool;
  }

  /**
   * 쿼리 실행
   */
  async query<T>(text: string, params?: any[]): Promise<T[]> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    const result = await this.pool.query(text, params);
    return result.rows as T[];
  }

  /**
   * 연결 상태 확인
   */
  isConnectedStatus(): boolean {
    return this.isConnected;
  }
}

export const dbConnection = new DatabaseConnection();
export default dbConnection;
