import fc from 'fast-check';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { initializePool, closePool, query } from '../../../../database/connection';

/**
 * Feature: ticketing-queue-system, Property 13: JSON 응답 형식
 * 
 * 임의의 API 엔드포인트에 요청했을 때, 응답은 유효한 JSON 형식이어야 합니다.
 * 
 * 검증: 요구사항 9.2
 */

describe('User Service - JSON Response Format Properties', () => {
  beforeAll(async () => {
    // Ensure database connection is ready
    await initializePool();
    await query('SELECT 1');
  });

  afterAll(async () => {
    // Clean up test data
    await query('DELETE FROM sessions WHERE user_id IN (SELECT user_id FROM users WHERE username LIKE $1)', ['test_%']);
    await query('DELETE FROM users WHERE username LIKE $1', ['test_%']);
    await closePool();
  });

  describe('Property 13: JSON 응답 형식', () => {
    it('should return valid JSON for user registration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 20 }).map(s => `test_${s}_${Date.now()}`),
          fc.emailAddress(),
          async (username, email) => {
            const response = await request(app)
              .post('/api/users/register')
              .send({ username, email: `test_${Date.now()}_${email}` });

            // Should return valid JSON
            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();

            if (response.status === 201) {
              expect(response.body).toHaveProperty('userId');
              expect(response.body).toHaveProperty('sessionToken');
              expect(typeof response.body.userId).toBe('string');
              expect(typeof response.body.sessionToken).toBe('string');
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return valid JSON for error responses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('', '   ', 'a', 'ab'),
          async (invalidUsername) => {
            const response = await request(app)
              .post('/api/users/register')
              .send({ username: invalidUsername, email: 'test@example.com' });

            // Even error responses should be valid JSON
            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();

            if (response.status >= 400) {
              expect(response.body).toHaveProperty('error');
              expect(response.body).toHaveProperty('message');
              expect(response.body).toHaveProperty('statusCode');
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should return valid JSON for user authentication', async () => {
      // First create a user
      const username = `test_auth_${Date.now()}`;
      const email = `test_auth_${Date.now()}@example.com`;
      
      const registerResponse = await request(app)
        .post('/api/users/register')
        .send({ username, email });

      if (registerResponse.status === 201) {
        const { sessionToken } = registerResponse.body;

        await fc.assert(
          fc.asyncProperty(
            fc.constant(sessionToken),
            async (token) => {
              const response = await request(app)
                .get('/api/users/auth')
                .set('Authorization', `Bearer ${token}`);

              expect(response.headers['content-type']).toMatch(/application\/json/);
              expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();

              if (response.status === 200) {
                expect(response.body).toHaveProperty('userId');
                expect(response.body).toHaveProperty('username');
              }
            }
          ),
          { numRuns: 20 }
        );
      }
    });

    it('should return valid JSON for user info retrieval', async () => {
      // First create a user
      const username = `test_info_${Date.now()}`;
      const email = `test_info_${Date.now()}@example.com`;
      
      const registerResponse = await request(app)
        .post('/api/users/register')
        .send({ username, email });

      if (registerResponse.status === 201) {
        const { userId } = registerResponse.body;

        await fc.assert(
          fc.asyncProperty(
            fc.constant(userId),
            async (uid) => {
              const response = await request(app)
                .get(`/api/users/${uid}`);

              expect(response.headers['content-type']).toMatch(/application\/json/);
              expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();

              if (response.status === 200) {
                expect(response.body).toHaveProperty('userId');
                expect(response.body).toHaveProperty('username');
                expect(response.body).toHaveProperty('email');
                expect(response.body).toHaveProperty('createdAt');
              }
            }
          ),
          { numRuns: 20 }
        );
      }
    });

    it('should return valid JSON for health check', async () => {
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
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return valid JSON for 404 responses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (randomId) => {
            const response = await request(app)
              .get(`/api/users/${randomId}`);

            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();

            if (response.status === 404) {
              expect(response.body).toHaveProperty('error');
              expect(response.body).toHaveProperty('message');
              expect(response.body).toHaveProperty('statusCode');
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should ensure all JSON responses are parseable and serializable', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 20 }).map(s => `test_serial_${s}_${Date.now()}`),
          fc.emailAddress().map(e => `test_serial_${Date.now()}_${e}`),
          async (username, email) => {
            const response = await request(app)
              .post('/api/users/register')
              .send({ username, email });

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
