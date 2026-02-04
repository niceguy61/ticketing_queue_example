import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import {
  initializePool,
  getPool,
  checkConnection,
  closePool,
} from './connection';

/**
 * Property-Based Tests for Database Connection
 * Feature: ticketing-queue-system, Property 3: 환경 변수 설정 처리
 * Validates: Requirements 2.5, 11.5
 */

describe('Database Connection Properties', () => {
  beforeEach(async () => {
    // Close any existing pool before each test
    await closePool();
  });

  afterEach(async () => {
    // Clean up after each test
    await closePool();
  });

  /**
   * Property 3: Environment Variable Configuration Handling
   * When arbitrary environment variable settings are provided,
   * the system should correctly apply and operate with those settings
   */
  it('should handle DATABASE_URL environment variable configuration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          host: fc.constantFrom('localhost', '127.0.0.1', 'postgres'),
          port: fc.integer({ min: 5432, max: 5435 }),
          database: fc.constantFrom('ticketing', 'test_db', 'queue_db'),
          user: fc.constantFrom('admin', 'postgres', 'testuser'),
          password: fc.string({ minLength: 8, maxLength: 20 }),
        }),
        async (config) => {
          // Set DATABASE_URL environment variable
          const originalUrl = process.env.DATABASE_URL;
          process.env.DATABASE_URL = `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`;

          try {
            // Initialize pool with the environment variable
            const pool = initializePool();
            
            // Verify pool is created
            expect(pool).toBeDefined();
            expect(pool).toBe(getPool());
            
            // The pool should be configured with the environment variable
            // Note: We can't directly test connection without a real database
            // but we can verify the pool was created with the config
            expect(pool.options.connectionString).toBe(process.env.DATABASE_URL);
          } finally {
            // Restore original environment variable
            if (originalUrl) {
              process.env.DATABASE_URL = originalUrl;
            } else {
              delete process.env.DATABASE_URL;
            }
            await closePool();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle individual database configuration parameters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          host: fc.constantFrom('localhost', '127.0.0.1'),
          port: fc.integer({ min: 5432, max: 5435 }),
          database: fc.constantFrom('ticketing', 'test_db'),
          user: fc.constantFrom('admin', 'postgres'),
          poolMax: fc.integer({ min: 5, max: 20 }),
        }),
        async (config) => {
          // Clear DATABASE_URL and set individual parameters
          const originalUrl = process.env.DATABASE_URL;
          const originalHost = process.env.DB_HOST;
          const originalPort = process.env.DB_PORT;
          const originalName = process.env.DB_NAME;
          const originalUser = process.env.DB_USER;
          const originalPoolMax = process.env.DB_POOL_MAX;

          delete process.env.DATABASE_URL;
          process.env.DB_HOST = config.host;
          process.env.DB_PORT = config.port.toString();
          process.env.DB_NAME = config.database;
          process.env.DB_USER = config.user;
          process.env.DB_POOL_MAX = config.poolMax.toString();

          try {
            const pool = initializePool();
            
            expect(pool).toBeDefined();
            expect(pool.options.host).toBe(config.host);
            expect(pool.options.port).toBe(config.port);
            expect(pool.options.database).toBe(config.database);
            expect(pool.options.user).toBe(config.user);
            expect(pool.options.max).toBe(config.poolMax);
          } finally {
            // Restore original environment variables
            if (originalUrl) process.env.DATABASE_URL = originalUrl;
            if (originalHost) process.env.DB_HOST = originalHost;
            else delete process.env.DB_HOST;
            if (originalPort) process.env.DB_PORT = originalPort;
            else delete process.env.DB_PORT;
            if (originalName) process.env.DB_NAME = originalName;
            else delete process.env.DB_NAME;
            if (originalUser) process.env.DB_USER = originalUser;
            else delete process.env.DB_USER;
            if (originalPoolMax) process.env.DB_POOL_MAX = originalPoolMax;
            else delete process.env.DB_POOL_MAX;
            
            await closePool();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use default values when environment variables are not set', () => {
    // Clear all database-related environment variables
    const originalUrl = process.env.DATABASE_URL;
    const originalHost = process.env.DB_HOST;
    const originalPort = process.env.DB_PORT;
    const originalName = process.env.DB_NAME;
    const originalUser = process.env.DB_USER;

    delete process.env.DATABASE_URL;
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_NAME;
    delete process.env.DB_USER;

    try {
      const pool = initializePool();
      
      // Should use default values
      expect(pool.options.host).toBe('localhost');
      expect(pool.options.port).toBe(5432);
      expect(pool.options.database).toBe('ticketing');
      expect(pool.options.user).toBe('admin');
      expect(pool.options.max).toBe(10);
    } finally {
      // Restore original environment variables
      if (originalUrl) process.env.DATABASE_URL = originalUrl;
      if (originalHost) process.env.DB_HOST = originalHost;
      if (originalPort) process.env.DB_PORT = originalPort;
      if (originalName) process.env.DB_NAME = originalName;
      if (originalUser) process.env.DB_USER = originalUser;
    }
  });

  it('should reuse existing pool when getPool is called multiple times', () => {
    const pool1 = initializePool();
    const pool2 = getPool();
    const pool3 = getPool();
    
    // All should return the same pool instance
    expect(pool1).toBe(pool2);
    expect(pool2).toBe(pool3);
  });
});
