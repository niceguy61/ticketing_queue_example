import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import * as ticketModel from '../models/ticketModel';
import { initializePool, closePool, query } from '../../../../database/connection';
import { v4 as uuidv4 } from 'uuid';

/**
 * Property-based test for Ticket Validity Verification
 * Feature: ticketing-queue-system, Property 10: 티켓 유효성 검증
 * Validates: Requirements 7.3
 */

describe('Ticket Validity Verification Property Tests', () => {
  let testUserIds: string[] = [];

  beforeEach(async () => {
    // Initialize database connection
    initializePool();
    
    // Clean up test data
    await query('DELETE FROM tickets');
    await query('DELETE FROM sessions');
    await query('DELETE FROM users');
    
    // Create test users for ticket creation
    testUserIds = [];
    for (let i = 0; i < 5; i++) {
      const userId = uuidv4();
      await query(
        'INSERT INTO users (user_id, username, email) VALUES ($1, $2, $3)',
        [userId, `testuser${i}`, `test${i}@example.com`]
      );
      testUserIds.push(userId);
    }
  });

  afterEach(async () => {
    // Clean up test data
    await query('DELETE FROM tickets');
    await query('DELETE FROM sessions');
    await query('DELETE FROM users');
    await closePool();
  });

  it('should validate active non-expired tickets as valid', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            userIndex: fc.integer({ min: 0, max: 4 }),
            eventId: fc.option(fc.constantFrom('event-1', 'event-2', 'event-3', null), { nil: null }),
            expiresIn: fc.integer({ min: 10, max: 120 }) // Future expiry
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (ticketInputs) => {
          try {
            // Create all tickets
            for (const input of ticketInputs) {
              const userId = testUserIds[input.userIndex];
              const ticket = await ticketModel.createTicket({
                userId,
                eventId: input.eventId || undefined,
                expiresIn: input.expiresIn
              });
              
              // Verify ticket is valid
              const retrievedTicket = await ticketModel.getTicketById(ticket.ticket_id);
              expect(retrievedTicket).not.toBeNull();
              
              const isValid = ticketModel.isTicketValid(retrievedTicket!);
              expect(isValid).toBe(true);
              
              // Verify status is active
              expect(retrievedTicket!.status).toBe('active');
              
              // Verify expiry is in the future
              const now = new Date();
              const expiresAt = new Date(retrievedTicket!.expires_at);
              expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
            }
          } finally {
            // Clean tickets after each iteration
            await query('DELETE FROM tickets');
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);

  it('should invalidate expired tickets', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            userIndex: fc.integer({ min: 0, max: 4 }),
            eventId: fc.option(fc.constantFrom('event-1', 'event-2', 'event-3', null), { nil: null })
          }),
          { minLength: 1, maxLength: 15 }
        ),
        async (ticketInputs) => {
          try {
            // Create tickets with past expiry
            for (const input of ticketInputs) {
              const userId = testUserIds[input.userIndex];
              
              // Create ticket with very short expiry
              const ticket = await ticketModel.createTicket({
                userId,
                eventId: input.eventId || undefined,
                expiresIn: 0.001 // Very short expiry (0.06 seconds)
              });
              
              // Wait for ticket to expire
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Verify ticket is invalid due to expiry
              const retrievedTicket = await ticketModel.getTicketById(ticket.ticket_id);
              expect(retrievedTicket).not.toBeNull();
              
              const isValid = ticketModel.isTicketValid(retrievedTicket!);
              expect(isValid).toBe(false);
              
              // Verify expiry is in the past
              const now = new Date();
              const expiresAt = new Date(retrievedTicket!.expires_at);
              expect(expiresAt.getTime()).toBeLessThanOrEqual(now.getTime());
            }
          } finally {
            // Clean tickets after each iteration
            await query('DELETE FROM tickets');
          }
        }
      ),
      { numRuns: 50 } // Reduced runs due to sleep delays
    );
  }, 120000); // Longer timeout due to sleep

  it('should invalidate cancelled tickets', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            userIndex: fc.integer({ min: 0, max: 4 }),
            eventId: fc.option(fc.constantFrom('event-1', 'event-2', 'event-3', null), { nil: null }),
            expiresIn: fc.integer({ min: 10, max: 120 })
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (ticketInputs) => {
          try {
            // Create and cancel tickets
            for (const input of ticketInputs) {
              const userId = testUserIds[input.userIndex];
              const ticket = await ticketModel.createTicket({
                userId,
                eventId: input.eventId || undefined,
                expiresIn: input.expiresIn
              });
              
              // Cancel the ticket
              await ticketModel.updateTicketStatus(ticket.ticket_id, 'cancelled');
              
              // Verify ticket is invalid due to cancelled status
              const retrievedTicket = await ticketModel.getTicketById(ticket.ticket_id);
              expect(retrievedTicket).not.toBeNull();
              
              const isValid = ticketModel.isTicketValid(retrievedTicket!);
              expect(isValid).toBe(false);
              
              // Verify status is cancelled
              expect(retrievedTicket!.status).toBe('cancelled');
            }
          } finally {
            // Clean tickets after each iteration
            await query('DELETE FROM tickets');
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);

  it('should invalidate used tickets', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            userIndex: fc.integer({ min: 0, max: 4 }),
            eventId: fc.option(fc.constantFrom('event-1', 'event-2', 'event-3', null), { nil: null }),
            expiresIn: fc.integer({ min: 10, max: 120 })
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (ticketInputs) => {
          try {
            // Create and mark tickets as used
            for (const input of ticketInputs) {
              const userId = testUserIds[input.userIndex];
              const ticket = await ticketModel.createTicket({
                userId,
                eventId: input.eventId || undefined,
                expiresIn: input.expiresIn
              });
              
              // Mark ticket as used
              await ticketModel.updateTicketStatus(ticket.ticket_id, 'used');
              
              // Verify ticket is invalid due to used status
              const retrievedTicket = await ticketModel.getTicketById(ticket.ticket_id);
              expect(retrievedTicket).not.toBeNull();
              
              const isValid = ticketModel.isTicketValid(retrievedTicket!);
              expect(isValid).toBe(false);
              
              // Verify status is used
              expect(retrievedTicket!.status).toBe('used');
            }
          } finally {
            // Clean tickets after each iteration
            await query('DELETE FROM tickets');
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);

  it('should return null for non-existent ticket IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }),
        async (nonExistentTicketIds) => {
          // Verify all non-existent ticket IDs return null
          for (const ticketId of nonExistentTicketIds) {
            const retrievedTicket = await ticketModel.getTicketById(ticketId);
            expect(retrievedTicket).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);

  it('should correctly validate mixed ticket states', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            userIndex: fc.integer({ min: 0, max: 4 }),
            eventId: fc.option(fc.constantFrom('event-1', 'event-2', 'event-3', null), { nil: null }),
            expiresIn: fc.integer({ min: 10, max: 120 }),
            shouldCancel: fc.boolean(),
            shouldUse: fc.boolean()
          }),
          { minLength: 2, maxLength: 15 }
        ),
        async (ticketInputs) => {
          try {
            // Create tickets with various states
            for (const input of ticketInputs) {
              const userId = testUserIds[input.userIndex];
              const ticket = await ticketModel.createTicket({
                userId,
                eventId: input.eventId || undefined,
                expiresIn: input.expiresIn
              });
              
              let expectedValid = true;
              
              // Modify ticket state based on input
              if (input.shouldCancel) {
                await ticketModel.updateTicketStatus(ticket.ticket_id, 'cancelled');
                expectedValid = false;
              } else if (input.shouldUse) {
                await ticketModel.updateTicketStatus(ticket.ticket_id, 'used');
                expectedValid = false;
              }
              
              // Verify ticket validity matches expected state
              const retrievedTicket = await ticketModel.getTicketById(ticket.ticket_id);
              expect(retrievedTicket).not.toBeNull();
              
              const isValid = ticketModel.isTicketValid(retrievedTicket!);
              expect(isValid).toBe(expectedValid);
            }
          } finally {
            // Clean tickets after each iteration
            await query('DELETE FROM tickets');
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);
});
