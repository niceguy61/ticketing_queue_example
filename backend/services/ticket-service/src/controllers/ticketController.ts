import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import * as ticketModel from '../models/ticketModel';

/**
 * Ticket controller
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

/**
 * Issue a new ticket (internal API)
 * POST /api/tickets/issue
 * Requirements: 7.1, 7.2, 7.5
 */
export async function issueTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, eventId, expiresIn } = req.body;
    
    // Validate required fields
    if (!userId) {
      throw new ValidationError('userId is required');
    }
    
    // Create ticket
    const ticket = await ticketModel.createTicket({
      userId,
      eventId,
      expiresIn
    });
    
    logger.info('Ticket issued', { ticketId: ticket.ticket_id, userId });
    
    res.status(200).json({
      ticketId: ticket.ticket_id,
      userId: ticket.user_id,
      eventId: ticket.event_id,
      expiresAt: ticket.expires_at,
      status: ticket.status
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Verify a ticket
 * GET /api/tickets/verify/:ticketId
 * Requirements: 7.3, 7.4
 */
export async function verifyTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const { ticketId } = req.params;
    
    if (!ticketId) {
      throw new ValidationError('ticketId is required');
    }
    
    // Get ticket
    const ticket = await ticketModel.getTicketById(ticketId);
    
    if (!ticket) {
      return res.status(200).json({
        valid: false,
        message: 'Ticket not found'
      });
    }
    
    // Check validity
    const isValid = ticketModel.isTicketValid(ticket);
    
    // If expired, update status
    if (!isValid && ticket.status === 'active') {
      const now = new Date();
      if (now > new Date(ticket.expires_at)) {
        await ticketModel.updateTicketStatus(ticketId, 'expired');
      }
    }
    
    res.status(200).json({
      valid: isValid,
      ticketId: ticket.ticket_id,
      userId: ticket.user_id,
      eventId: ticket.event_id,
      expiresAt: ticket.expires_at,
      status: ticket.status
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Cancel a ticket
 * DELETE /api/tickets/:ticketId
 * Requirements: 7.3
 */
export async function cancelTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const { ticketId } = req.params;
    
    if (!ticketId) {
      throw new ValidationError('ticketId is required');
    }
    
    // Get ticket
    const ticket = await ticketModel.getTicketById(ticketId);
    
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }
    
    // Update status to cancelled
    await ticketModel.updateTicketStatus(ticketId, 'cancelled');
    
    logger.info('Ticket cancelled', { ticketId });
    
    res.status(200).json({
      success: true,
      message: 'Ticket cancelled successfully',
      ticketId
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all tickets for a user
 * GET /api/tickets/user/:userId
 * Requirements: 7.5
 */
export async function getUserTickets(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      throw new ValidationError('userId is required');
    }
    
    // Get tickets
    const tickets = await ticketModel.getTicketsByUserId(userId);
    
    res.status(200).json({
      tickets: tickets.map(ticket => ({
        ticketId: ticket.ticket_id,
        userId: ticket.user_id,
        eventId: ticket.event_id,
        issuedAt: ticket.issued_at,
        expiresAt: ticket.expires_at,
        status: ticket.status
      }))
    });
  } catch (error) {
    next(error);
  }
}
