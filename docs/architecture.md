# System Architecture

This document describes the architecture of the Ticketing Queue System.

## Overview

The system follows a microservices architecture pattern with the following components:

1. **Queue Service** - Manages waiting queues
2. **Ticket Service** - Issues and validates tickets
3. **User Service** - Handles user management
4. **Frontend** - React-based user interface

## Architecture Diagram

```
┌─────────────────┐
│   Frontend      │
│   (React)       │
└────────┬────────┘
         │ HTTP/WebSocket
         │
    ┌────┴────┬──────────┬──────────┐
    │         │          │          │
┌───▼───┐ ┌──▼──┐  ┌────▼────┐ ┌──▼──────┐
│Queue  │ │User │  │ Ticket  │ │Frontend │
│Service│ │Svc  │  │ Service │ │ Service │
└───┬───┘ └──┬──┘  └────┬────┘ └─────────┘
    │        │           │
    │   ┌────▼───────────▼────┐
    │   │   PostgreSQL        │
    │   └─────────────────────┘
    │
┌───▼───┐
│ Redis │
└───────┘
```

## Service Communication

- **Synchronous**: REST APIs for service-to-service communication
- **Asynchronous**: Socket.io for real-time client updates
- **Data Storage**: Redis for queue state, PostgreSQL for persistent data

For detailed design information, see `.kiro/specs/ticketing-queue-system/design.md`
