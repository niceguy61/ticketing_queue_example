export type QueueMode = 'simple' | 'advanced' | 'lobby' | 'ticket';

export interface User {
  userId: string;
  username: string;
  email: string;
  sessionToken: string;
}

export interface QueuePosition {
  queueId: string;
  position: number;
  estimatedWaitTime: number;
}

export interface QueueStatus {
  totalWaiting: number;
  currentServing: number;
  capacity?: number;
}

export interface Ticket {
  ticketId: string;
  userId: string;
  eventId?: string;
  issuedAt: string;
  expiresAt: string;
  status: 'active' | 'used' | 'expired' | 'cancelled';
}

export interface Event {
  eventId: string;
  name: string;
  available: number;
  capacity: number;
}
