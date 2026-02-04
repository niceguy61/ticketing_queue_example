import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import * as userModel from '../models/userModel';
import { initializePool, closePool, query } from '../../../../database/connection';

/**
 * Property-based test for duplicate user registration rejection
 * Feature: ticketing-queue-system, Property 12: 중복 사용자 등록 거부
 * Validates: Requirements 8.4
 */

describe('Duplicate User Registration Rejection Property Tests', () => {
  beforeEach(async () => {
    // Initialize database connection
    initializePool();
    
    // Clean up test data
    await query('DELETE FROM sessions');
    await query('DELETE FROM users');
  });

  afterEach(async () => {
    // Clean up test data
    await query('DELETE FROM sessions');
    await query('DELETE FROM users');
    await closePool();
  });

  it('should reject duplicate username registration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          username: fc.uuid(),
          email1: fc.uuid().map(uuid => `${uuid}_1@test.com`),
          email2: fc.uuid().map(uuid => `${uuid}_2@test.com`)
        }),
        async (input) => {
          try {
            const username = input.username;
            const email1 = input.email1;
            const email2 = input.email2;
            
            // Create first user with username
            const user1 = await userModel.createUser(username, email1);
            expect(user1.username).toBe(username);
            
            // Attempt to create second user with same username but different email
            let errorThrown = false;
            try {
              await userModel.createUser(username, email2);
            } catch (error: any) {
              errorThrown = true;
              // PostgreSQL unique constraint violation error code
              expect(error.code).toBe('23505');
            }
            
            // Verify that duplicate username was rejected
            expect(errorThrown).toBe(true);
          } finally {
            // Clean database after each iteration to avoid conflicts during shrinking
            await query('DELETE FROM sessions');
            await query('DELETE FROM users');
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30000); // 30 second timeout for PBT

  it('should reject duplicate email registration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          username1: fc.uuid().map(uuid => `${uuid}-1`),
          username2: fc.uuid().map(uuid => `${uuid}-2`),
          email: fc.uuid().map(uuid => `${uuid}@test.com`)
        }),
        async (input) => {
          try {
            const username1 = input.username1;
            const username2 = input.username2;
            const email = input.email;
            
            // Create first user with email
            const user1 = await userModel.createUser(username1, email);
            expect(user1.email).toBe(email);
            
            // Attempt to create second user with same email but different username
            let errorThrown = false;
            try {
              await userModel.createUser(username2, email);
            } catch (error: any) {
              errorThrown = true;
              // PostgreSQL unique constraint violation error code
              expect(error.code).toBe('23505');
            }
            
            // Verify that duplicate email was rejected
            expect(errorThrown).toBe(true);
          } finally {
            // Clean database after each iteration to avoid conflicts during shrinking
            await query('DELETE FROM sessions');
            await query('DELETE FROM users');
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30000); // 30 second timeout for PBT

  it('should reject exact duplicate user registration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          username: fc.uuid(),
          email: fc.uuid().map(uuid => `${uuid}@test.com`)
        }),
        async (input) => {
          try {
            const username = input.username;
            const email = input.email;
            
            // Create first user
            const user1 = await userModel.createUser(username, email);
            expect(user1.username).toBe(username);
            expect(user1.email).toBe(email);
            
            // Attempt to create exact duplicate
            let errorThrown = false;
            try {
              await userModel.createUser(username, email);
            } catch (error: any) {
              errorThrown = true;
              // PostgreSQL unique constraint violation error code
              expect(error.code).toBe('23505');
            }
            
            // Verify that duplicate was rejected
            expect(errorThrown).toBe(true);
          } finally {
            // Clean database after each iteration to avoid conflicts during shrinking
            await query('DELETE FROM sessions');
            await query('DELETE FROM users');
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30000); // 30 second timeout for PBT
});
