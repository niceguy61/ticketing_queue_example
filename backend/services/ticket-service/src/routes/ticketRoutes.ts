import { Router } from 'express';
import * as ticketController from '../controllers/ticketController';

/**
 * Ticket routes
 * Requirements: 7.1, 7.2, 7.3, 7.5
 */

const router = Router();

// Issue ticket (internal API)
router.post('/issue', ticketController.issueTicket);

// Verify ticket
router.get('/verify/:ticketId', ticketController.verifyTicket);

// Cancel ticket
router.delete('/:ticketId', ticketController.cancelTicket);

// Get user tickets
router.get('/user/:userId', ticketController.getUserTickets);

export default router;
