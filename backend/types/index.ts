/**
 * Common type definitions for the Ticketing Queue System
 * Shared across all microservices
 */

// ============================================================================
// Queue Types
// ============================================================================

export type QueueMode = 'simple' | 'advanced';

export interface QueueEntry {
  userId: string;
  joinedAt: number; // Unix timestamp
  eventId?: string; // Only used in Advanced mode
}

export interface QueueConfig {
  mode: QueueMode;
  lobbyCapacity: number;
  processingRate: number; // Users per second
  ticketEvents?: {
    [eventId: string]: {
      name: string;
      capacity: number;
      processingRate: number;
    };
  };
}

export interface QueueStatus {
  totalWaiting: number;
  currentServing: number;
  capacity?: number;
}

export interface QueuePosition {
  position: number;
  estimatedWaitTime: number; // seconds
}

export interface JoinQueueResponse {
  queueId: string;
  position: number;
  estimatedWaitTime: number;
  success: boolean;
  error?: string;
}

// ============================================================================
// User Types
// ============================================================================

export interface User {
  userId: string;
  username: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  sessionId: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface RegisterUserRequest {
  username: string;
  email: string;
}

export interface RegisterUserResponse {
  userId: string;
  sessionToken: string;
}

export interface AuthResponse {
  userId: string;
  username: string;
}

// ============================================================================
// Ticket Types
// ============================================================================

export type TicketStatus = 'active' | 'used' | 'expired' | 'cancelled';

export interface Ticket {
  ticketId: string;
  userId: string;
  eventId?: string; // NULL for simple mode
  issuedAt: Date;
  expiresAt: Date;
  status: TicketStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueTicketRequest {
  userId: string;
  eventId?: string;
}

export interface IssueTicketResponse {
  ticketId: string;
  expiresAt: Date;
}

export interface VerifyTicketResponse {
  valid: boolean;
  userId?: string;
  eventId?: string;
  expiresAt?: Date;
}

// ============================================================================
// Event Types (Advanced Mode)
// ============================================================================

export interface TicketEvent {
  eventId: string;
  name: string;
  available: number;
  capacity: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  retryAfter?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// ============================================================================
// Socket.io Event Types
// ============================================================================

export interface SocketQueueJoinEvent {
  userId: string;
  mode: 'lobby' | 'ticket';
  eventId?: string;
}

export interface SocketQueueLeaveEvent {
  userId: string;
}

export interface SocketPositionUpdateEvent {
  position: number;
  estimatedWaitTime: number;
}

export interface SocketYourTurnEvent {
  ticketId: string;
}

export interface SocketStatusUpdateEvent {
  totalWaiting: number;
  currentServing: number;
}

export interface SocketErrorEvent {
  message: string;
  code: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface ServiceConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

export interface DatabaseConfig {
  url: string;
  maxConnections: number;
  idleTimeoutMs: number;
}

export interface RedisConfig {
  url: string;
  maxRetries: number;
  retryDelayMs: number;
}
