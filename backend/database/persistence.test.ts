import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  initializePool,
  closePool,
  query,
  initializeSchema,
} from './connection';

/**
 * Property-Based Tests for Data Persistence
 * Feature: ticketing-queue-system, Property 16: 데이터 영속성 및 복구
 * Validates: Requirements 11.2, 11.3, 11.4
 */

describe('Data Persistence Properties', () => {
  // Skip tests if no real database is available
  const skipTests = !process.env.DATABASE_URL && !process.env.DB_HOST;

  beforeAll(async () => {
    if (skipTests) {
      console.log('Skipping persistence tests - no database configured');
      return;
    }

    try {
      // Initialize database connection and schema
      initializePool();
      await initializeSchema();
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  });

  afterAll(async () => {
    if (skipTests) return;
    await closePool();
  });

  beforeEach(async () => {
    if (skipTests) return;

    // Clean up test data before each test
    try {
      await query('DELETE FROM tickets');
      await query('DELETE FROM sessions');
      await query('DELETE FROM users');
    } catch (error) {
      console.error('Failed to clean up test data:', error);
    }
  });

  /**
   * Property 16: Data Persistence and Recovery
   * When arbitrary data (users, tickets) is stored and the service is restarted,
   * the stored data should be retrievable without loss
   */
  it('should persist and retrieve user data after service restart', async () => {
    if (skipTests) {
      console.log('Test skipped - no database configured');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            username: fc.string({ minLength: 3, maxLength: 20 }).map(s => `user_${s}`),
            email: fc.emailAddress(),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (users) => {
          // Make usernames and emails unique
          const uniqueUsers = Array.from(
            new Map(users.map(u => [u.username, u])).values()
          );

          // Insert users
          const insertedUserIds: string[] = [];
          for (const user of uniqueUsers) {
            try {
              const result = await query<{ user_id: string }>(
                'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING user_id',
                [user.username, user.email]
              );
              insertedUserIds.push(result[0].user_id);
            } catch (error) {
              // Skip duplicate entries
              continue;
            }
          }

          // Simulate service restart by closing and reopening connection
          await closePool();
          initializePool();

          // Verify all users can be retrieved
          for (let i = 0; i < insertedUserIds.length; i++) {
            const userId = insertedUserIds[i];
            const retrievedUsers = await query<{
              user_id: string;
              username: string;
              email: string;
            }>('SELECT user_id, username, email FROM users WHERE user_id = $1', [
              userId,
            ]);

            expect(retrievedUsers.length).toBe(1);
            expect(retrievedUsers[0].user_id).toBe(userId);
            expect(retrievedUsers[0].username).toBe(uniqueUsers[i].username);
            expect(retrievedUsers[0].email).toBe(uniqueUsers[i].email);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should persist and retrieve ticket data after service restart', async () => {
    if (skipTests) {
      console.log('Test skipped - no database configured');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          username: fc.string({ minLength: 3, maxLength: 20 }).map(s => `user_${s}`),
          email: fc.emailAddress(),
          tickets: fc.array(
            fc.record({
              eventId: fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: null }),
              expiresInMinutes: fc.integer({ min: 1, max: 60 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
        }),
        async (testData) => {
          // Create user
          const userResult = await query<{ user_id: string }>(
            'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING user_id',
            [testData.username, testData.email]
          );
          const userId = userResult[0].user_id;

          // Create tickets
          const ticketIds: string[] = [];
          for (const ticket of testData.tickets) {
            const expiresAt = new Date(
              Date.now() + ticket.expiresInMinutes * 60 * 1000
            );
            const result = await query<{ ticket_id: string }>(
              'INSERT INTO tickets (user_id, event_id, expires_at) VALUES ($1, $2, $3) RETURNING ticket_id',
              [userId, ticket.eventId, expiresAt]
            );
            ticketIds.push(result[0].ticket_id);
          }

          // Simulate service restart
          await closePool();
          initializePool();

          // Verify all tickets can be retrieved
          const retrievedTickets = await query<{
            ticket_id: string;
            user_id: string;
            event_id: string | null;
            status: string;
          }>('SELECT ticket_id, user_id, event_id, status FROM tickets WHERE user_id = $1', [
            userId,
          ]);

          expect(retrievedTickets.length).toBe(ticketIds.length);
          
          for (const ticketId of ticketIds) {
            const ticket = retrievedTickets.find(t => t.ticket_id === ticketId);
            expect(ticket).toBeDefined();
            expect(ticket!.user_id).toBe(userId);
            expect(ticket!.status).toBe('active');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain data integrity across multiple restart cycles', async () => {
    if (skipTests) {
      console.log('Test skipped - no database configured');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        fc.string({ minLength: 3, maxLength: 20 }).map(s => `user_${s}`),
        fc.emailAddress(),
        async (restartCount, username, email) => {
          // Create initial user
          const userResult = await query<{ user_id: string }>(
            'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING user_id',
            [username, email]
          );
          const userId = userResult[0].user_id;

          // Perform multiple restart cycles
          for (let i = 0; i < restartCount; i++) {
            // Close and reopen connection
            await closePool();
            initializePool();

            // Verify user still exists
            const users = await query<{ user_id: string }>(
              'SELECT user_id FROM users WHERE user_id = $1',
              [userId]
            );
            expect(users.length).toBe(1);
            expect(users[0].user_id).toBe(userId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve session data after service restart', async () => {
    if (skipTests) {
      console.log('Test skipped - no database configured');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          username: fc.string({ minLength: 3, maxLength: 20 }).map(s => `user_${s}`),
          email: fc.emailAddress(),
          token: fc.uuid(),
          expiresInHours: fc.integer({ min: 1, max: 24 }),
        }),
        async (sessionData) => {
          // Create user
          const userResult = await query<{ user_id: string }>(
            'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING user_id',
            [sessionData.username, sessionData.email]
          );
          const userId = userResult[0].user_id;

          // Create session
          const expiresAt = new Date(
            Date.now() + sessionData.expiresInHours * 60 * 60 * 1000
          );
          const sessionResult = await query<{ session_id: string }>(
            'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3) RETURNING session_id',
            [userId, sessionData.token, expiresAt]
          );
          const sessionId = sessionResult[0].session_id;

          // Simulate service restart
          await closePool();
          initializePool();

          // Verify session can be retrieved
          const sessions = await query<{
            session_id: string;
            user_id: string;
            token: string;
          }>('SELECT session_id, user_id, token FROM sessions WHERE session_id = $1', [
            sessionId,
          ]);

          expect(sessions.length).toBe(1);
          expect(sessions[0].session_id).toBe(sessionId);
          expect(sessions[0].user_id).toBe(userId);
          expect(sessions[0].token).toBe(sessionData.token);
        }
      ),
      { numRuns: 100 }
    );
  });
});
