import { Pool, PoolClient, PoolConfig } from 'pg';

/**
 * Database connection module for PostgreSQL
 * Requirements: 11.5 - Environment variable configuration
 * Requirements: 1.2 - Retry logic for database connections
 */

let pool: Pool | null = null;

/**
 * Retry options for database operations
 */
interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 5000,
  backoffMultiplier: 2
};

/**
 * Retry a database operation with exponential backoff
 */
async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;
  let delayMs = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable (connection errors)
      const isRetryable = 
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.message?.includes('connection') ||
        error.message?.includes('timeout');

      if (!isRetryable || attempt === opts.maxRetries) {
        throw error;
      }

      console.warn(`Database operation failed (attempt ${attempt}/${opts.maxRetries}), retrying in ${delayMs}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Get database configuration from environment variables
 */
function getDatabaseConfig(): PoolConfig {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
    };
  }
  
  // Fallback to individual environment variables
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'ticketing',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'password',
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
  };
}

/**
 * Initialize database connection pool
 */
export function initializePool(): Pool {
  if (pool) {
    return pool;
  }
  
  const config = getDatabaseConfig();
  pool = new Pool(config);
  
  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });
  
  return pool;
}

/**
 * Get the database connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    return initializePool();
  }
  return pool;
}

/**
 * Check database connection status
 * Returns true if connection is successful, false otherwise
 * Includes retry logic for transient failures
 */
export async function checkConnection(): Promise<boolean> {
  try {
    return await retryDatabaseOperation(async () => {
      const currentPool = getPool();
      const client = await currentPool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    });
  } catch (error) {
    console.error('Database connection check failed after retries:', error);
    return false;
  }
}

/**
 * Execute a query with the connection pool
 * Includes retry logic for transient failures
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  return await retryDatabaseOperation(async () => {
    const currentPool = getPool();
    const result = await currentPool.query(text, params);
    return result.rows;
  });
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  const currentPool = getPool();
  return await currentPool.connect();
}

/**
 * Close the database connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Initialize database schema
 * Reads and executes schema.sql file
 */
export async function initializeSchema(): Promise<void> {
  const fs = require('fs');
  const path = require('path');
  
  const schemaPath = path.join(__dirname, 'schema.sql');
  
  if (!fs.existsSync(schemaPath)) {
    throw new Error('Schema file not found: ' + schemaPath);
  }
  
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  const currentPool = getPool();
  
  await currentPool.query(schemaSql);
}
