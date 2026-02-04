# Queue Service API

대기열 관리 서비스 API 문서입니다.

## Base URL

```
http://localhost:3001/api/queue
```

## 공통 API

### 큐 모드 조회

현재 운영 모드를 반환합니다.

**Endpoint:** `GET /api/queue/mode`

**Response (200 OK):**
```json
{
  "mode": "simple" | "advanced"
}
```

---

## 로비 대기열 API

### 로비 대기열 진입

사용자를 로비 대기열에 추가합니다.

**Endpoint:** `POST /api/queue/lobby/join`

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (200 OK):**
```json
{
  "queueId": "lobby-550e8400-e29b-41d4-a716-446655440000",
  "position": 1,
  "estimatedWaitTime": 60,
  "totalWaiting": 1
}
```

**Error Responses:**
| Status | Error | Description |
|--------|-------|-------------|
| 400 | ValidationError | userId 누락 또는 잘못된 UUID 형식 |
| 409 | ConflictError | 이미 대기열에 있는 사용자 |
| 503 | QueueFullError | 대기열 용량 초과 |

---

### 로비 대기열 상태 조회

로비 대기열의 현재 상태를 반환합니다.

**Endpoint:** `GET /api/queue/lobby/status`

**Response (200 OK):**
```json
{
  "totalWaiting": 5,
  "capacity": 1000,
  "available": 995,
  "currentServing": 0
}
```

---

### 사용자 대기 위치 조회

특정 사용자의 대기열 위치를 반환합니다.

**Endpoint:** `GET /api/queue/lobby/position/:userId`

**Response (200 OK):**
```json
{
  "position": 3,
  "estimatedWaitTime": 180,
  "totalWaiting": 10
}
```

**Error Responses:**
| Status | Error | Description |
|--------|-------|-------------|
| 400 | ValidationError | 대기열에 없는 사용자 |

---

### 로비 대기열 이탈

사용자를 로비 대기열에서 제거합니다.

**Endpoint:** `DELETE /api/queue/lobby/leave/:userId`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User removed from queue"
}
```

**Error Responses:**
| Status | Error | Description |
|--------|-------|-------------|
| 400 | ValidationError | 대기열에 없는 사용자 |

---

## Advanced 모드 API

### 티케팅 이벤트 목록 조회

사용 가능한 티케팅 이벤트 목록을 반환합니다.

**Endpoint:** `GET /api/queue/events`

**Response (200 OK):**
```json
{
  "events": [
    {
      "eventId": "bts-concert",
      "name": "BTS World Tour Seoul Concert",
      "capacity": 50,
      "available": 45,
      "currentWaiting": 5,
      "processingRate": 10
    },
    {
      "eventId": "lim-younghung",
      "name": "Lim Young-woong National Tour Concert",
      "capacity": 50,
      "available": 50,
      "currentWaiting": 0,
      "processingRate": 10
    }
  ]
}
```

**Error Responses:**
| Status | Error | Description |
|--------|-------|-------------|
| 400 | ValidationError | Advanced 모드가 아닌 경우 |

---

### 티켓 대기열 진입

사용자를 특정 이벤트의 티켓 대기열에 추가합니다.

**Endpoint:** `POST /api/queue/ticket/join`

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "eventId": "bts-concert"
}
```

**Response (200 OK):**
```json
{
  "queueId": "ticket-bts-concert-550e8400-e29b-41d4-a716-446655440000",
  "eventId": "bts-concert",
  "eventName": "BTS World Tour Seoul Concert",
  "position": 1,
  "estimatedWaitTime": 60,
  "totalWaiting": 1
}
```

**Error Responses:**
| Status | Error | Description |
|--------|-------|-------------|
| 400 | ValidationError | userId/eventId 누락, 잘못된 형식, 존재하지 않는 이벤트 |
| 409 | ConflictError | 이미 해당 티켓 대기열에 있는 사용자 |
| 503 | QueueFullError | 티켓 대기열 용량 초과 |

---

### 티켓 대기열 상태 조회

특정 이벤트의 티켓 대기열 상태를 반환합니다.

**Endpoint:** `GET /api/queue/ticket/:eventId/status`

**Response (200 OK):**
```json
{
  "eventId": "bts-concert",
  "eventName": "BTS World Tour Seoul Concert",
  "totalWaiting": 5,
  "capacity": 50,
  "available": 45,
  "currentServing": 0
}
```

**Error Responses:**
| Status | Error | Description |
|--------|-------|-------------|
| 400 | ValidationError | Advanced 모드가 아니거나 존재하지 않는 이벤트 |

---

### 로비에서 티켓 대기열로 이동

로비 대기열에서 특정 이벤트의 티켓 대기열로 이동합니다.

**Endpoint:** `POST /api/queue/lobby/move-to-ticket`

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "eventId": "bts-concert"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "queueId": "ticket-bts-concert-550e8400-e29b-41d4-a716-446655440000",
  "eventId": "bts-concert",
  "eventName": "BTS World Tour Seoul Concert",
  "position": 1,
  "estimatedWaitTime": 60,
  "totalWaiting": 1,
  "message": "Successfully moved to ticket queue"
}
```

**Error Responses:**
| Status | Error | Description |
|--------|-------|-------------|
| 400 | ValidationError | 로비 대기열에 없는 사용자, 존재하지 않는 이벤트 |
| 409 | ConflictError | 이미 해당 티켓 대기열에 있는 사용자 |
| 503 | QueueFullError | 티켓 대기열 용량 초과 |

---

## Socket.io Events

### Client → Server Events

#### `queue:join`
사용자별 룸에 참여하여 실시간 업데이트를 받습니다.

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "mode": "lobby" | "ticket",
  "eventId": "bts-concert"  // mode가 "ticket"인 경우 필수
}
```

#### `queue:leave`
사용자별 룸에서 나갑니다.

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### Server → Client Events

#### `queue:position-update`
대기열 위치가 변경될 때 전송됩니다.

```json
{
  "position": 2,
  "estimatedWaitTime": 120,
  "totalWaiting": 5
}
```

#### `queue:status-update`
전체 대기열 상태가 변경될 때 전송됩니다.

```json
{
  "totalWaiting": 5,
  "capacity": 1000
}
```

#### `queue:your-turn`
사용자의 차례가 되었을 때 전송됩니다.

**Simple 모드 (티켓 포함):**
```json
{
  "ticket": {
    "ticketId": "ticket-uuid",
    "userId": "user-uuid",
    "eventId": null,
    "expiresAt": "2026-02-04T03:34:26.000Z",
    "status": "active"
  }
}
```

**Advanced 모드 - 로비 (티켓 없음):**
```json
{
  "message": "Your turn! Please select an event."
}
```

**Advanced 모드 - 티켓 대기열 (티켓 포함):**
```json
{
  "ticket": {
    "ticketId": "ticket-uuid",
    "userId": "user-uuid",
    "eventId": "bts-concert",
    "expiresAt": "2026-02-04T03:34:26.000Z",
    "status": "active"
  }
}
```

---

## Health Check

**Endpoint:** `GET /health`

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-04T08:49:16.709Z",
  "service": "queue-service"
}
```
