import { getPool } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';

/**
 * Ticket model
 * Requirements: 7.1, 7.2, 7.5 - Ticket management
 */

export interface Ticket {
  ticket_id: string;
  user_id: string;
  event_id?: string;
  issued_at: Date;
  expires_at: Date;
  status: 'active' | 'used' | 'expired' | 'cancelled';
  created_at: Date;
  updated_at: Date;
}

export interface CreateTicketParams {
  userId: string;
  eventId?: string;
  expiresIn?: number; // Minutes, default from env
}

/**
 * Create a new ticket
 * Requirements: 7.1, 7.2, 7.5
 */
export async function createTicket(params: CreateTicketParams): Promise<Ticket> {
  const pool = getPool();
  const ticketId = uuidv4();
  const expiryMinutes = params.expiresIn || parseInt(process.env.TICKET_EXPIRY_MINUTES || '30', 10);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  
  const query = `
    INSERT INTO tickets (ticket_id, user_id, event_id, expires_at)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  
  const result = await pool.query(query, [
    ticketId,
    params.userId,
    params.eventId || null,
    expiresAt
  ]);
  
  return result.rows[0];
}

/**
 * Get ticket by ID
 * Requirements: 7.3
 */
export async function getTicketById(ticketId: string): Promise<Ticket | null> {
  const pool = getPool();
  
  const query = 'SELECT * FROM tickets WHERE ticket_id = $1';
  const result = await pool.query(query, [ticketId]);
  
  return result.rows[0] || null;
}

/**
 * Get all tickets for a user
 * Requirements: 7.5
 */
export async function getTicketsByUserId(userId: string): Promise<Ticket[]> {
  const pool = getPool();
  
  const query = `
    SELECT * FROM tickets 
    WHERE user_id = $1 
    ORDER BY created_at DESC
  `;
  const result = await pool.query(query, [userId]);
  
  return result.rows;
}

/**
 * Update ticket status
 * Requirements: 7.3
 */
export async function updateTicketStatus(
  ticketId: string,
  status: 'active' | 'used' | 'expired' | 'cancelled'
): Promise<Ticket | null> {
  const pool = getPool();
  
  const query = `
    UPDATE tickets 
    SET status = $1, updated_at = NOW()
    WHERE ticket_id = $2
    RETURNING *
  `;
  
  const result = await pool.query(query, [status, ticketId]);
  
  return result.rows[0] || null;
}

/**
 * Check if ticket is valid
 * Requirements: 7.3, 7.4
 */
export function isTicketValid(ticket: Ticket): boolean {
  if (ticket.status !== 'active') {
    return false;
  }
  
  const now = new Date();
  if (now > new Date(ticket.expires_at)) {
    return false;
  }
  
  return true;
}
