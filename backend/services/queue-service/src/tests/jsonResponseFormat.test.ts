import fc from 'fast-check';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express, { Application } from 'express';
import redisConnection from '../redis/connection';
import { errorHandler } from '../middleware/errorHandler';

/**
 * Feature: ticketing-queue-system, Property 13: JSON 응답 형식
 * 
 * 임의의 API 엔드포인트에 요청했을 때, 응답은 유효한 JSON 형식이어야 합니다.
 * 
 * 검증: 요구사항 9.2
 */

describe('JSON Response Format Properties', () => {
  let app: Application;

  beforeAll(async () => {
    // Redis 연결
    await redisConnection.connect();

    // Redis 연결 후 라우트 import
    const queueRoutes = (await import('../routes/queueRoutes')).default;

    // Express 앱 설정
    app = express();
    app.use(express.json());
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'queue-service',
        dependencies: {
          redis: 'connected'
        }
      });
    });
    
    app.use('/api/queue', queueRoutes);
    
    // 404 handler for unmatched routes
    app.use((req, res, next) => {
      res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found',
        statusCode: 404
      });
    });
    
    app.use(errorHandler);
  });

  afterAll(async () => {
    await redisConnection.disconnect();
  });

  describe('Property 13: JSON 응답 형식', () => {
    it('should return valid JSON for health check endpoint', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const response = await request(app).get('/health');

            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('service');
            expect(response.body).toHaveProperty('dependencies');
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return valid JSON for 404 not found responses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('/')),
          async (randomPath) => {
            const response = await request(app)
              .get(`/api/nonexistent/${randomPath}`);

            expect(response.status).toBe(404);
            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('statusCode');
            expect(response.body.statusCode).toBe(404);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should return valid JSON for queue status endpoint', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const response = await request(app)
              .get('/api/queue/lobby/status');

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
            expect(response.body).toHaveProperty('totalWaiting');
            expect(response.body).toHaveProperty('capacity');
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return valid JSON for events endpoint', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const response = await request(app)
              .get('/api/queue/events');

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
            expect(response.body).toHaveProperty('events');
            expect(Array.isArray(response.body.events)).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should ensure all JSON responses are parseable and serializable', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const response = await request(app).get('/health');

            // Test that response can be stringified and parsed back
            const stringified = JSON.stringify(response.body);
            const parsed = JSON.parse(stringified);

            expect(parsed).toEqual(response.body);

            // Test that all values are JSON-compatible types
            const checkJsonCompatible = (obj: any): boolean => {
              if (obj === null || obj === undefined) return true;
              if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') return true;
              if (Array.isArray(obj)) return obj.every(checkJsonCompatible);
              if (typeof obj === 'object') {
                return Object.values(obj).every(checkJsonCompatible);
              }
              return false;
            };

            expect(checkJsonCompatible(response.body)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
