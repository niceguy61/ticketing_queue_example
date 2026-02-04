import { Request, Response, NextFunction } from 'express';
import * as userModel from '../models/userModel';
import { ValidationError, ConflictError, NotFoundError, UnauthorizedError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

/**
 * User controller
 * Requirements: 8.1, 8.2, 8.3, 8.5 - User management APIs
 */

/**
 * Register a new user
 * POST /api/users/register
 * Requirements: 8.1, 8.2 - User registration with unique ID and session token generation
 */
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { username, email } = req.body;
    
    // Input validation
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      throw new ValidationError('username is required and must be a non-empty string');
    }
    
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      throw new ValidationError('email is required and must be a non-empty string');
    }
    
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('email must be a valid email address');
    }
    
    // Check for existing user by username
    const existingUserByUsername = await userModel.findUserByUsername(username);
    
    if (existingUserByUsername) {
      // Username exists - check if email also matches (login case)
      if (existingUserByUsername.email === email) {
        // Both username and email match - treat as login
        const expiryHours = parseInt(process.env.SESSION_EXPIRY_HOURS || '24', 10);
        const session = await userModel.createSession(existingUserByUsername.user_id, expiryHours);
        
        logger.info(`User logged in (existing): ${existingUserByUsername.user_id}`);
        
        return res.status(200).json({
          userId: existingUserByUsername.user_id,
          sessionToken: session.token
        });
      }
      // Username exists but email doesn't match
      throw new ConflictError('Username already exists with a different email');
    }
    
    // Check for duplicate email (username is new but email might exist)
    const existingUserByEmail = await userModel.findUserByEmail(email);
    if (existingUserByEmail) {
      throw new ConflictError('Email already exists with a different username');
    }
    
    // Create new user
    const user = await userModel.createUser(username, email);
    
    // Create session token
    const expiryHours = parseInt(process.env.SESSION_EXPIRY_HOURS || '24', 10);
    const session = await userModel.createSession(user.user_id, expiryHours);
    
    logger.info(`User registered: ${user.user_id}`);
    
    res.status(201).json({
      userId: user.user_id,
      sessionToken: session.token
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Authenticate user with session token
 * GET /api/users/auth
 * Requirements: 8.3 - User authentication with session token verification
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authorization header with Bearer token is required');
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Find session by token
    const session = await userModel.findSessionByToken(token);
    
    if (!session) {
      throw new UnauthorizedError('Invalid or expired session token');
    }
    
    // Get user information
    const user = await userModel.findUserById(session.user_id);
    
    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    
    res.status(200).json({
      userId: user.user_id,
      username: user.username
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get user information by ID
 * GET /api/users/:userId
 * Requirements: 8.5 - User information retrieval
 */
export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      throw new ValidationError('userId is required');
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      throw new NotFoundError('User not found');
    }
    
    const user = await userModel.findUserById(userId);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    res.status(200).json({
      userId: user.user_id,
      username: user.username,
      email: user.email,
      createdAt: user.created_at
    });
  } catch (error) {
    next(error);
  }
}
