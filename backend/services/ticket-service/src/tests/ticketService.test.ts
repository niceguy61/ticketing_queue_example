import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getPool, initializeSchema, closePool } from '../../../../database/connection';
import { v4 as uuidv4 } from 'uuid';

/**
 * Ticket Service unit tests
 * Requirements: 7.1, 7.3, 7.5
 */

describe('Ticket Service', () => {
  let testUserId: string;
  
  beforeAll(async () => {
    // Initialize database schema (skip if already exists)
    try {
      await initializeSchema();
    } catch (error) {
      // Schema already exists, continue
    }
    
    // Create a test user
    const pool = getPool();
    testUserId = uuidv4();
    await pool.query(
      'INSERT INTO users (user_id, username, email) VALUES ($1, $2, $3)',
      [testUserId, 'testuser', 'test@example.com']
    );
  });
  
  afterAll(async () => {
    // Clean up test data
    const pool = getPool();
    await pool.query('DELETE FROM tickets WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE user_id = $1', [testUserId]);
    await closePool();
  });
  
  beforeEach(async () => {
    // Clean up tickets before each test
    const pool = getPool();
    await pool.query('DELETE FROM tickets WHERE user_id = $1', [testUserId]);
  });
  
  describe('POST /api/tickets/issue', () => {
    it('should issue a ticket successfully', async () => {
      const response = await request(app)
        .post('/api/tickets/issue')
        .send({ userId: testUserId });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ticketId');
      expect(response.body).toHaveProperty('userId', testUserId);
      expect(response.body).toHaveProperty('expiresAt');
      expect(response.body).toHaveProperty('status', 'active');
    });
    
    it('should issue a ticket with eventId for advanced mode', async () => {
      const eventId = 'event-123';
      const response = await request(app)
        .post('/api/tickets/issue')
        .send({ userId: testUserId, eventId });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ticketId');
      expect(response.body).toHaveProperty('eventId', eventId);
    });
    
    it('should reject request without userId', async () => {
      const response = await request(app)
        .post('/api/tickets/issue')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Bad Request');
    });
    
    it('should set custom expiry time', async () => {
      const expiresIn = 60; // 60 minutes
      const response = await request(app)
        .post('/api/tickets/issue')
        .send({ userId: testUserId, expiresIn });
      
      expect(response.status).toBe(200);
      
      const expiresAt = new Date(response.body.expiresAt);
      const now = new Date();
      const diffMinutes = (expiresAt.getTime() - now.getTime()) / (1000 * 60);
      
      // Allow 1 minute tolerance
      expect(diffMinutes).toBeGreaterThan(59);
      expect(diffMinutes).toBeLessThan(61);
    });
  });
  
  describe('GET /api/tickets/verify/:ticketId', () => {
    it('should verify a valid ticket', async () => {
      // Issue a ticket first
      const issueResponse = await request(app)
        .post('/api/tickets/issue')
        .send({ userId: testUserId });
      
      const ticketId = issueResponse.body.ticketId;
      
      // Verify the ticket
      const verifyResponse = await request(app)
        .get(`/api/tickets/verify/${ticketId}`);
      
      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body).toHaveProperty('valid', true);
      expect(verifyResponse.body).toHaveProperty('ticketId', ticketId);
    });
    
    it('should return invalid for non-existent ticket', async () => {
      const fakeTicketId = uuidv4();
      
      const response = await request(app)
        .get(`/api/tickets/verify/${fakeTicketId}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('valid', false);
      expect(response.body).toHaveProperty('message', 'Ticket not found');
    });
    
    it('should return invalid for expired ticket', async () => {
      // Create a ticket directly in the database with past expiry
      const pool = getPool();
      const expiredTicketId = uuidv4();
      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      
      await pool.query(
        'INSERT INTO tickets (ticket_id, user_id, expires_at) VALUES ($1, $2, $3)',
        [expiredTicketId, testUserId, pastDate]
      );
      
      // Verify the ticket
      const verifyResponse = await request(app)
        .get(`/api/tickets/verify/${expiredTicketId}`);
      
      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body).toHaveProperty('valid', false);
    });
  });
  
  describe('DELETE /api/tickets/:ticketId', () => {
    it('should cancel a ticket successfully', async () => {
      // Issue a ticket first
      const issueResponse = await request(app)
        .post('/api/tickets/issue')
        .send({ userId: testUserId });
      
      const ticketId = issueResponse.body.ticketId;
      
      // Cancel the ticket
      const cancelResponse = await request(app)
        .delete(`/api/tickets/${ticketId}`);
      
      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body).toHaveProperty('success', true);
      expect(cancelResponse.body).toHaveProperty('ticketId', ticketId);
      
      // Verify ticket is cancelled
      const verifyResponse = await request(app)
        .get(`/api/tickets/verify/${ticketId}`);
      
      expect(verifyResponse.body).toHaveProperty('valid', false);
      expect(verifyResponse.body).toHaveProperty('status', 'cancelled');
    });
    
    it('should return 404 for non-existent ticket', async () => {
      const fakeTicketId = uuidv4();
      
      const response = await request(app)
        .delete(`/api/tickets/${fakeTicketId}`);
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Not Found');
    });
  });
  
  describe('GET /api/tickets/user/:userId', () => {
    it('should return all tickets for a user', async () => {
      // Issue multiple tickets
      await request(app)
        .post('/api/tickets/issue')
        .send({ userId: testUserId });
      
      await request(app)
        .post('/api/tickets/issue')
        .send({ userId: testUserId, eventId: 'event-1' });
      
      // Get user tickets
      const response = await request(app)
        .get(`/api/tickets/user/${testUserId}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tickets');
      expect(response.body.tickets).toHaveLength(2);
    });
    
    it('should return empty array for user with no tickets', async () => {
      const newUserId = uuidv4();
      
      // Create a new user
      const pool = getPool();
      await pool.query(
        'INSERT INTO users (user_id, username, email) VALUES ($1, $2, $3)',
        [newUserId, 'newuser', 'new@example.com']
      );
      
      const response = await request(app)
        .get(`/api/tickets/user/${newUserId}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tickets');
      expect(response.body.tickets).toHaveLength(0);
      
      // Clean up
      await pool.query('DELETE FROM users WHERE user_id = $1', [newUserId]);
    });
  });
  
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('service', 'ticket-service');
      expect(response.body).toHaveProperty('dependencies');
    });
  });
  
  describe('Error handling', () => {
    it('should return 404 for undefined routes', async () => {
      const response = await request(app).get('/api/tickets/undefined-route');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Not Found');
    });
    
    it('should handle invalid JSON', async () => {
      const response = await request(app)
        .post('/api/tickets/issue')
        .set('Content-Type', 'application/json')
        .send('invalid json');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Bad Request');
    });
  });
});
