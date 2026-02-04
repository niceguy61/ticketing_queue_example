import { v4 as uuidv4 } from 'uuid';
import { query, getClient } from '../database/connection';

/**
 * User model
 * Requirements: 8.1, 8.2, 8.5 - User registration, ID generation, and retrieval
 */

export interface User {
  user_id: string;
  username: string;
  email: string;
  created_at: Date;
  updated_at: Date;
}

export interface Session {
  session_id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  created_at: Date;
}

/**
 * Create a new user
 * Requirements: 8.1, 8.2 - User registration with unique ID generation
 */
export async function createUser(username: string, email: string): Promise<User> {
  const userId = uuidv4();
  
  const result = await query<User>(
    `INSERT INTO users (user_id, username, email)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, username, email]
  );
  
  return result[0];
}

/**
 * Find user by username
 */
export async function findUserByUsername(username: string): Promise<User | null> {
  const result = await query<User>(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Find user by email
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await query<User>(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Find user by ID
 * Requirements: 8.5 - User information retrieval
 */
export async function findUserById(userId: string): Promise<User | null> {
  const result = await query<User>(
    'SELECT * FROM users WHERE user_id = $1',
    [userId]
  );
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Create a session token for a user
 * Requirements: 8.2 - Session token generation
 */
export async function createSession(userId: string, expiryHours: number = 24): Promise<Session> {
  const sessionId = uuidv4();
  const token = uuidv4(); // Simple token generation
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiryHours);
  
  const result = await query<Session>(
    `INSERT INTO sessions (session_id, user_id, token, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [sessionId, userId, token, expiresAt]
  );
  
  return result[0];
}

/**
 * Find session by token
 * Requirements: 8.3 - Session token verification
 */
export async function findSessionByToken(token: string): Promise<Session | null> {
  const result = await query<Session>(
    'SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW()',
    [token]
  );
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Delete expired sessions
 */
export async function deleteExpiredSessions(): Promise<void> {
  await query(
    'DELETE FROM sessions WHERE expires_at <= NOW()'
  );
}
