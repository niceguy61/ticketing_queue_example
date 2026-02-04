# Development Guide

This guide covers local development setup for the Ticketing Queue System.

## Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL 15+
- Redis 7+
- Docker (optional, for containerized development)

## Setup

### 1. Install Dependencies

```bash
npm run install:all
```

### 2. Database Setup

#### PostgreSQL

Create a database:
```sql
CREATE DATABASE ticketing;
```

#### Redis

Start Redis server:
```bash
redis-server
```

### 3. Environment Configuration

Copy and configure environment files for each service:

```bash
cp services/queue-service/.env.example services/queue-service/.env
cp services/ticket-service/.env.example services/ticket-service/.env
cp services/user-service/.env.example services/user-service/.env
cp frontend/.env.example frontend/.env
```

Update the `.env` files with your local configuration.

### 4. Build Services

```bash
npm run build:all
```

## Running Services

### Development Mode

Each service can be run independently in development mode:

```bash
# Queue Service
cd services/queue-service
npm run dev

# Ticket Service
cd services/ticket-service
npm run dev

# User Service
cd services/user-service
npm run dev

# Frontend
cd frontend
npm run dev
```

### Production Mode

Build and run in production mode:

```bash
npm run build:all

# Start each service
cd services/queue-service && npm start
cd services/ticket-service && npm start
cd services/user-service && npm start
```

## Testing

Run tests for all services:
```bash
npm run test:all
```

Run tests for a specific service:
```bash
cd services/queue-service
npm test
```

## Code Quality

Lint code:
```bash
npm run lint
```

Format code:
```bash
npm run format
```

## Troubleshooting

### Port Conflicts

Default ports:
- Queue Service: 3001
- Ticket Service: 3002
- User Service: 3003
- Frontend: 3000

Change ports in respective `.env` files if needed.

### Database Connection Issues

Verify PostgreSQL is running:
```bash
psql -U admin -d ticketing
```

Verify Redis is running:
```bash
redis-cli ping
```
