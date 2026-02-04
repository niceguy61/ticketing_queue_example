export const config = {
  queueServiceUrl: import.meta.env.VITE_QUEUE_SERVICE_URL || 'http://localhost:3001',
  ticketServiceUrl: import.meta.env.VITE_TICKET_SERVICE_URL || 'http://localhost:3002',
  userServiceUrl: import.meta.env.VITE_USER_SERVICE_URL || 'http://localhost:3003',
  socketReconnectionDelay: 1000,
  socketReconnectionAttempts: 5,
};
