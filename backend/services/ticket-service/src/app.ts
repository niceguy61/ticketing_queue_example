import express, { Application } from 'express';
import cors from 'cors';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import ticketRoutes from './routes/ticketRoutes';

/**
 * Express application setup
 * Requirements: 1.4 - Ticket Service basic structure
 */

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Health check endpoint
// Requirements: 10.5
app.get('/health', async (req, res) => {
  try {
    // Try to import and check database connection
    let dbConnected = false;
    try {
      const dbModule = await import('./database/connection');
      dbConnected = await dbModule.checkConnection();
    } catch (importError) {
      // If import fails, database is not available
      dbConnected = false;
    }
    
    const health = {
      status: dbConnected ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'ticket-service',
      dependencies: {
        database: dbConnected ? 'connected' : 'disconnected'
      }
    };
    
    // Return 200 even if database is down (service itself is healthy)
    res.status(200).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'ticket-service',
      dependencies: {
        database: 'disconnected'
      }
    });
  }
});

// Routes
app.use('/api/tickets', ticketRoutes);

// 404 handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    statusCode: 404
  });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
