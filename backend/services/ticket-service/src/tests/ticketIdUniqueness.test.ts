import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import * as ticketModel from '../models/ticketModel';
import { initializePool, closePool, query } from '../../../../database/connection';
import { v4 as uuidv4 } from 'uuid';

/**
 * Property-based test for Ticket ID uniqueness
 * Feature: ticketing-queue-system, Property 9: 티켓 ID 고유성 및 저장
 * Validates: Requirements 7.1, 7.5, 11.2
 */

describe('Ticket ID Uniqueness Property Tests', () => {
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

  it('should generate unique ticket IDs for all ticket issuances', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            userIndex: fc.integer({ min: 0, max: 4 }),
            eventId: fc.option(fc.constantFrom('event-1', 'event-2', 'event-3', null), { nil: null }),
            expiresIn: fc.integer({ min: 10, max: 120 })
          }),
          { minLength: 2, maxLength: 30 }
        ),
        async (ticketInputs) => {
          try {
            const createdTicketIds = new Set<string>();
            
            // Create all tickets
            for (const input of ticketInputs) {
              const userId = testUserIds[input.userIndex];
              const ticket = await ticketModel.createTicket({
                userId,
                eventId: input.eventId || undefined,
                expiresIn: input.expiresIn
              });
              
              // Check that ticket ID is unique
              expect(createdTicketIds.has(ticket.ticket_id)).toBe(false);
              createdTicketIds.add(ticket.ticket_id);
              
              // Verify ticket can be retrieved from database
              const retrievedTicket = await ticketModel.getTicketById(ticket.ticket_id);
              expect(retrievedTicket).not.toBeNull();
              expect(retrievedTicket?.ticket_id).toBe(ticket.ticket_id);
              expect(retrievedTicket?.user_id).toBe(userId);
              
              if (input.eventId) {
                expect(retrievedTicket?.event_id).toBe(input.eventId);
              }
            }
            
            // Verify all ticket IDs are unique
            expect(createdTicketIds.size).toBe(ticketInputs.length);
          } finally {
            // Clean tickets after each iteration to avoid conflicts during shrinking
            await query('DELETE FROM tickets');
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 60000); // 60 second timeout for PBT

  it('should store and retrieve all created tickets from database', async () => {
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
            const createdTickets: ticketModel.Ticket[] = [];
            
            // Create all tickets
            for (const input of ticketInputs) {
              const userId = testUserIds[input.userIndex];
              const ticket = await ticketModel.createTicket({
                userId,
                eventId: input.eventId || undefined,
                expiresIn: input.expiresIn
              });
              createdTickets.push(ticket);
            }
            
            // Verify all tickets can be retrieved
            for (const createdTicket of createdTickets) {
              const retrievedTicket = await ticketModel.getTicketById(createdTicket.ticket_id);
              
              expect(retrievedTicket).not.toBeNull();
              expect(retrievedTicket?.ticket_id).toBe(createdTicket.ticket_id);
              expect(retrievedTicket?.user_id).toBe(createdTicket.user_id);
              expect(retrievedTicket?.status).toBe('active');
              
              // Verify expiry time is set correctly
              const expiresAt = new Date(retrievedTicket!.expires_at);
              const now = new Date();
              expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
            }
          } finally {
            // Clean tickets after each iteration to avoid conflicts during shrinking
            await query('DELETE FROM tickets');
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 60000); // 60 second timeout for PBT

  it('should retrieve tickets by user ID correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            userIndex: fc.integer({ min: 0, max: 4 }),
            eventId: fc.option(fc.constantFrom('event-1', 'event-2', 'event-3', null), { nil: null }),
            expiresIn: fc.integer({ min: 10, max: 120 })
          }),
          { minLength: 1, maxLength: 15 }
        ),
        async (ticketInputs) => {
          try {
            // Track tickets per user
            const ticketsByUser = new Map<string, ticketModel.Ticket[]>();
            
            // Create all tickets
            for (const input of ticketInputs) {
              const userId = testUserIds[input.userIndex];
              const ticket = await ticketModel.createTicket({
                userId,
                eventId: input.eventId || undefined,
                expiresIn: input.expiresIn
              });
              
              if (!ticketsByUser.has(userId)) {
                ticketsByUser.set(userId, []);
              }
              ticketsByUser.get(userId)!.push(ticket);
            }
            
            // Verify tickets can be retrieved by user ID
            for (const [userId, expectedTickets] of ticketsByUser.entries()) {
              const retrievedTickets = await ticketModel.getTicketsByUserId(userId);
              
              expect(retrievedTickets.length).toBe(expectedTickets.length);
              
              // Verify all expected tickets are in the retrieved list
              const retrievedTicketIds = new Set(retrievedTickets.map(t => t.ticket_id));
              for (const expectedTicket of expectedTickets) {
                expect(retrievedTicketIds.has(expectedTicket.ticket_id)).toBe(true);
              }
            }
          } finally {
            // Clean tickets after each iteration to avoid conflicts during shrinking
            await query('DELETE FROM tickets');
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 60000); // 60 second timeout for PBT
});
