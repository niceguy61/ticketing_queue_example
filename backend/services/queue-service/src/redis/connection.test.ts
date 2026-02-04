import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import redisConnection from './connection';

describe('Redis Connection', () => {
  beforeAll(async () => {
    await redisConnection.connect();
  });

  afterAll(async () => {
    await redisConnection.disconnect();
  });

  it('should connect to Redis server', async () => {
    const isHealthy = await redisConnection.healthCheck();
    expect(isHealthy).toBe(true);
  });

  it('should return connected client', () => {
    const client = redisConnection.getClient();
    expect(client).toBeDefined();
  });

  it('should check connection health', () => {
    const isHealthy = redisConnection.isConnectionHealthy();
    expect(isHealthy).toBe(true);
  });

  it('should perform basic Redis operations', async () => {
    const client = redisConnection.getClient();
    
    // Set a test value
    await client.set('test:key', 'test-value');
    
    // Get the value
    const value = await client.get('test:key');
    expect(value).toBe('test-value');
    
    // Clean up
    await client.del('test:key');
  });
});
