import { Router } from 'express';
import * as userController from '../controllers/userController';

const router = Router();

/**
 * User routes
 * Requirements: 8.1, 8.3, 8.5 - User registration, authentication, and retrieval APIs
 */

// User registration
router.post('/register', userController.register);

// User authentication
router.get('/auth', userController.authenticate);

// User retrieval
router.get('/:userId', userController.getUser);

export default router;
