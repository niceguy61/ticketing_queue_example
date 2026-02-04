# Ticket Service API

티켓 발급 및 관리 서비스 API 문서입니다.

## Base URL

```
http://localhost:3002/api/tickets
```

---

## Endpoints

### 티켓 발급 (내부 API)

새로운 티켓을 발급합니다. Queue Service에서 내부적으로 호출됩니다.

**Endpoint:** `POST /api/tickets/issue`

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "eventId": "bts-concert",
  "expiresIn": 1800
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string (UUID) | ✅ | 사용자 ID |
| eventId | string | ❌ | 이벤트 ID (Advanced 모드) |
| expiresIn | number | ❌ | 만료 시간 (초), 기본값: 1800 (30분) |

**Response (200 OK):**
```json
{
  "ticketId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "eventId": "bts-concert",
  "expiresAt": "2026-02-04T09:19:26.000Z",
  "status": "active"
}
```

**Error Responses:**
| Status | Error | Description |
|--------|-------|-------------|
| 400 | ValidationError | userId 누락 |

---

### 티켓 검증

티켓의 유효성을 확인합니다.

**Endpoint:** `GET /api/tickets/verify/:ticketId`

**Response (200 OK) - 유효한 티켓:**
```json
{
  "valid": true,
  "ticketId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "eventId": "bts-concert",
  "expiresAt": "2026-02-04T09:19:26.000Z",
  "status": "active"
}
```

**Response (200 OK) - 유효하지 않은 티켓:**
```json
{
  "valid": false,
  "message": "Ticket not found"
}
```

**Response (200 OK) - 만료된 티켓:**
```json
{
  "valid": false,
  "ticketId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "eventId": "bts-concert",
  "expiresAt": "2026-02-04T08:19:26.000Z",
  "status": "expired"
}
```

---

### 티켓 취소

티켓을 취소합니다.

**Endpoint:** `DELETE /api/tickets/:ticketId`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Ticket cancelled successfully",
  "ticketId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Error Responses:**
| Status | Error | Description |
|--------|-------|-------------|
| 400 | ValidationError | ticketId 누락 |
| 404 | NotFoundError | 존재하지 않는 티켓 |

---

### 사용자 티켓 조회

특정 사용자의 모든 티켓을 조회합니다.

**Endpoint:** `GET /api/tickets/user/:userId`

**Response (200 OK):**
```json
{
  "tickets": [
    {
      "ticketId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "eventId": "bts-concert",
      "issuedAt": "2026-02-04T08:49:26.000Z",
      "expiresAt": "2026-02-04T09:19:26.000Z",
      "status": "active"
    },
    {
      "ticketId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "eventId": "lim-younghung",
      "issuedAt": "2026-02-03T10:00:00.000Z",
      "expiresAt": "2026-02-03T10:30:00.000Z",
      "status": "expired"
    }
  ]
}
```

**Error Responses:**
| Status | Error | Description |
|--------|-------|-------------|
| 400 | ValidationError | userId 누락 |

---

## Data Models

### Ticket

```typescript
interface Ticket {
  ticket_id: string;      // UUID
  user_id: string;        // UUID, 사용자 ID
  event_id: string | null; // 이벤트 ID (Advanced 모드)
  issued_at: string;      // ISO 8601 timestamp
  expires_at: string;     // ISO 8601 timestamp
  status: 'active' | 'used' | 'expired' | 'cancelled';
}
```

### Ticket Status

| Status | Description |
|--------|-------------|
| `active` | 유효한 티켓 |
| `used` | 사용된 티켓 |
| `expired` | 만료된 티켓 |
| `cancelled` | 취소된 티켓 |

---

## Health Check

**Endpoint:** `GET /health`

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-04T08:49:16.709Z",
  "service": "ticket-service",
  "dependencies": {
    "database": "connected"
  }
}
```

---

## Database Schema

### Tickets Table

```sql
CREATE TABLE tickets (
  ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id),
  event_id VARCHAR(100),
  issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_event_id ON tickets(event_id);
```

---

## Environment Variables

```bash
# Database connection
DATABASE_URL=postgresql://user:password@localhost:5432/ticketing

# Server configuration
PORT=3002
NODE_ENV=development

# Ticket configuration
TICKET_EXPIRY_MINUTES=30
```
