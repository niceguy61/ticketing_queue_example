import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import * as userModel from '../models/userModel';
import { initializePool, closePool, query } from '../../../../database/connection';

/**
 * Property-based test for User ID uniqueness
 * Feature: ticketing-queue-system, Property 11: 사용자 ID 고유성 및 저장
 * Validates: Requirements 8.2, 11.3
 */

describe('User ID Uniqueness Property Tests', () => {
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

  it('should generate unique user IDs for all user registrations', async () => {
    let iterationCounter = 0;
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            username: fc.uuid(),
            email: fc.uuid().map(uuid => `${uuid}@test.com`)
          }),
          { minLength: 2, maxLength: 20 }
        ),
        async (userInputs) => {
          try {
            // Use iteration counter to ensure uniqueness across all test runs
            const uniquePrefix = `iter${iterationCounter++}`;
            const createdUserIds = new Set<string>();
            
            // Create all users
            for (const input of userInputs) {
              const username = `${uniquePrefix}-${input.username}`;
              const email = `${uniquePrefix}-${input.email}`;
              const user = await userModel.createUser(username, email);
              
              // Check that user ID is unique
              expect(createdUserIds.has(user.user_id)).toBe(false);
              createdUserIds.add(user.user_id);
              
              // Verify user can be retrieved from database
              const retrievedUser = await userModel.findUserById(user.user_id);
              expect(retrievedUser).not.toBeNull();
              expect(retrievedUser?.user_id).toBe(user.user_id);
              expect(retrievedUser?.username).toBe(username);
              expect(retrievedUser?.email).toBe(email);
            }
            
            // Verify all user IDs are unique
            expect(createdUserIds.size).toBe(userInputs.length);
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

  it('should store and retrieve all created users from database', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            username: fc.uuid(),
            email: fc.uuid().map(uuid => `${uuid}@test.com`)
          }),
          { minLength: 1, maxLength: 15 }
        ),
        async (userInputs) => {
          try {
            const createdUsers: userModel.User[] = [];
            
            // Create all users
            for (const input of userInputs) {
              const username = input.username;
              const email = input.email;
              const user = await userModel.createUser(username, email);
              createdUsers.push(user);
            }
            
            // Verify all users can be retrieved
            for (const createdUser of createdUsers) {
              const retrievedUser = await userModel.findUserById(createdUser.user_id);
              
              expect(retrievedUser).not.toBeNull();
              expect(retrievedUser?.user_id).toBe(createdUser.user_id);
              expect(retrievedUser?.username).toBe(createdUser.username);
              expect(retrievedUser?.email).toBe(createdUser.email);
            }
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
