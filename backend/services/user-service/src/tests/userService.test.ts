import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { initializePool, closePool, query } from '../../../../database/connection';

/**
 * Unit tests for User Service
 * Requirements: 8.1, 8.3, 8.5 - API endpoint validation and error handling
 */

describe('User Service Unit Tests', () => {
  beforeAll(async () => {
    initializePool();
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    // Clean up test data
    await query('DELETE FROM sessions');
    await query('DELETE FROM users');
  });

  describe('POST /api/users/register', () => {
    it('should provide user registration endpoint', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({
          username: 'testuser',
          email: 'test@example.com'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('sessionToken');
    });

    it('should reject registration with missing username', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('username');
    });

    it('should reject registration with missing email', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({
          username: 'testuser'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('email');
    });

    it('should reject registration with invalid email format', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({
          username: 'testuser',
          email: 'invalid-email'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('email');
    });

    it('should reject registration with empty username', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({
          username: '',
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });

    it('should reject duplicate username registration', async () => {
      // First registration
      await request(app)
        .post('/api/users/register')
        .send({
          username: 'testuser',
          email: 'test1@example.com'
        });

      // Duplicate username
      const response = await request(app)
        .post('/api/users/register')
        .send({
          username: 'testuser',
          email: 'test2@example.com'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Conflict');
      expect(response.body.message).toContain('Username');
    });

    it('should reject duplicate email registration', async () => {
      // First registration
      await request(app)
        .post('/api/users/register')
        .send({
          username: 'testuser1',
          email: 'test@example.com'
        });

      // Duplicate email
      const response = await request(app)
        .post('/api/users/register')
        .send({
          username: 'testuser2',
          email: 'test@example.com'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Conflict');
      expect(response.body.message).toContain('Email');
    });
  });

  describe('GET /api/users/auth', () => {
    it('should provide authentication endpoint', async () => {
      // Register a user first
      const registerResponse = await request(app)
        .post('/api/users/register')
        .send({
          username: 'testuser',
          email: 'test@example.com'
        });

      const token = registerResponse.body.sessionToken;

      // Authenticate with token
      const response = await request(app)
        .get('/api/users/auth')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('username');
      expect(response.body.username).toBe('testuser');
    });

    it('should reject authentication without token', async () => {
      const response = await request(app)
        .get('/api/users/auth');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should reject authentication with invalid token', async () => {
      const response = await request(app)
        .get('/api/users/auth')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should reject authentication with malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/users/auth')
        .set('Authorization', 'InvalidFormat token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('GET /api/users/:userId', () => {
    it('should provide user retrieval endpoint', async () => {
      // Register a user first
      const registerResponse = await request(app)
        .post('/api/users/register')
        .send({
          username: 'testuser',
          email: 'test@example.com'
        });

      const userId = registerResponse.body.userId;

      // Retrieve user
      const response = await request(app)
        .get(`/api/users/${userId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('username');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body.username).toBe('testuser');
      expect(response.body.email).toBe('test@example.com');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/users/00000000-0000-0000-0000-000000000000');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('GET /health', () => {
    it('should provide health check endpoint', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('service');
      expect(response.body.service).toBe('user-service');
    });
  });

  describe('Error Handling', () => {
    it('should return JSON error response for invalid routes', async () => {
      const response = await request(app)
        .get('/api/users/invalid-route');

      expect(response.status).toBe(404);
    });

    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });
  });
});
