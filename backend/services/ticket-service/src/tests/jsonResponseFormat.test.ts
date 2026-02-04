import fc from 'fast-check';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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

describe('Ticket Service - JSON Response Format Properties', () => {
  const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    // Ensure database connection is ready
    await initializePool();
    await query('SELECT 1');
    
    // Create test user
    await query(`
      INSERT INTO users (user_id, username, email)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO NOTHING
    `, [TEST_USER_ID, 'test_json_user', 'test_json@example.com']);
  });

  afterAll(async () => {
    // Clean up test data
    await query('DELETE FROM tickets WHERE user_id = $1', [TEST_USER_ID]);
    await query('DELETE FROM users WHERE user_id = $1', [TEST_USER_ID]);
    await closePool();
  });

  beforeEach(async () => {
    // Clean up tickets before each test
    await query('DELETE FROM tickets WHERE user_id = $1', [TEST_USER_ID]);
  });

  describe('Property 13: JSON 응답 형식', () => {
    it('should return valid JSON for ticket issuance', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(TEST_USER_ID),
          fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: undefined }),
          async (userId, eventId) => {
            const response = await request(app)
              .post('/api/tickets/issue')
              .send({ userId, eventId });

            // Should return valid JSON
            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();

            if (response.status === 200) {
              expect(response.body).toHaveProperty('ticketId');
              expect(response.body).toHaveProperty('userId');
              expect(response.body).toHaveProperty('expiresAt');
              expect(typeof response.body.ticketId).toBe('string');
              expect(typeof response.body.userId).toBe('string');
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return valid JSON for ticket verification', async () => {
      // First issue a ticket
      const issueResponse = await request(app)
        .post('/api/tickets/issue')
        .send({ userId: TEST_USER_ID });

      if (issueResponse.status === 200) {
        const { ticketId } = issueResponse.body;

        await fc.assert(
          fc.asyncProperty(
            fc.constant(ticketId),
            async (tid) => {
              const response = await request(app)
                .get(`/api/tickets/verify/${tid}`);

              expect(response.headers['content-type']).toMatch(/application\/json/);
              expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();

              expect(response.body).toHaveProperty('valid');
              expect(typeof response.body.valid).toBe('boolean');

              if (response.body.valid) {
                expect(response.body).toHaveProperty('ticketId');
                expect(response.body).toHaveProperty('userId');
                expect(response.body).toHaveProperty('expiresAt');
              }
            }
          ),
          { numRuns: 20 }
        );
      }
    });

    it('should return valid JSON for ticket cancellation', async () => {
      // First issue a ticket
      const issueResponse = await request(app)
        .post('/api/tickets/issue')
        .send({ userId: TEST_USER_ID });

      if (issueResponse.status === 200) {
        const { ticketId } = issueResponse.body;

        await fc.assert(
          fc.asyncProperty(
            fc.constant(ticketId),
            async (tid) => {
              const response = await request(app)
                .delete(`/api/tickets/${tid}`);

              expect(response.headers['content-type']).toMatch(/application\/json/);
              expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();

              if (response.status === 200) {
                expect(response.body).toHaveProperty('success');
                expect(response.body).toHaveProperty('message');
                expect(typeof response.body.success).toBe('boolean');
              }
            }
          ),
          { numRuns: 20 }
        );
      }
    });

    it('should return valid JSON for user tickets retrieval', async () => {
      // Issue some tickets first
      await request(app)
        .post('/api/tickets/issue')
        .send({ userId: TEST_USER_ID });

      await fc.assert(
        fc.asyncProperty(
          fc.constant(TEST_USER_ID),
          async (userId) => {
            const response = await request(app)
              .get(`/api/tickets/user/${userId}`);

            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();

            if (response.status === 200) {
              expect(response.body).toHaveProperty('tickets');
              expect(Array.isArray(response.body.tickets)).toBe(true);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return valid JSON for error responses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('', '   ', 'invalid'),
          async (invalidUserId) => {
            const response = await request(app)
              .post('/api/tickets/issue')
              .send({ userId: invalidUserId });

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
              .get(`/api/tickets/verify/${randomId}`);

            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();

            // Ticket verification returns 200 with valid: false for not found
            expect(response.body).toHaveProperty('valid');
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should ensure all JSON responses are parseable and serializable', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(TEST_USER_ID),
          async (userId) => {
            const response = await request(app)
              .post('/api/tickets/issue')
              .send({ userId });

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
