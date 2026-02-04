import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from '../utils/logger';

/**
 * PostgreSQL Database Connection
 * User Service용 데이터베이스 연결 관리
 */

let pool: Pool | null = null;

/**
 * 데이터베이스 연결 풀 가져오기 (초기화 포함)
 */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString,
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', { error: err.message });
    });

    logger.info('Database pool created');
  }

  return pool;
}

/**
 * 데이터베이스 연결 확인
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const p = getPool();
    const client = await p.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Database connection check failed', { error });
    return false;
  }
}

/**
 * 데이터베이스 연결 풀 초기화 (별칭)
 */
export async function connect(): Promise<void> {
  const isConnected = await checkConnection();
  if (!isConnected) {
    throw new Error('Failed to connect to database');
  }
  logger.info('Database connected successfully');
}

/**
 * 데이터베이스 연결 풀 종료
 */
export async function disconnect(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database disconnected');
  }
}

/**
 * 쿼리 실행
 */
export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const p = getPool();
  const result: QueryResult<T> = await p.query(text, params);
  return result.rows;
}

/**
 * 클라이언트 가져오기 (트랜잭션용)
 */
export async function getClient(): Promise<PoolClient> {
  const p = getPool();
  return p.connect();
}

/**
 * 헬스 체크 (별칭)
 */
export async function healthCheck(): Promise<boolean> {
  return checkConnection();
}

export default {
  getPool,
  checkConnection,
  connect,
  disconnect,
  query,
  getClient,
  healthCheck,
};
