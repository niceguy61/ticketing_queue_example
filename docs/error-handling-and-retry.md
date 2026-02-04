# 에러 처리 및 재시도 로직 가이드

## 개요

이 문서는 티케팅 대기열 시스템의 에러 처리 및 재시도 로직 구현에 대해 설명합니다.

## 구현된 기능

### 1. 에러 핸들러 미들웨어 (Task 16.1) ✅

모든 서비스(Queue, Ticket, User)에 통일된 에러 핸들러가 구현되어 있습니다.

#### 커스텀 에러 클래스

```typescript
// ValidationError - 400 Bad Request
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// NotFoundError - 404 Not Found
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

// ConflictError - 409 Conflict
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

// QueueFullError - 429 Too Many Requests (Queue Service only)
export class QueueFullError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueueFullError';
  }
}

// UnauthorizedError - 401 Unauthorized (Ticket/User Service)
export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
```

#### 에러 응답 형식

모든 에러 응답은 다음 형식을 따릅니다:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "statusCode": 400,
  "field": "optional field name for validation errors"
}
```

#### HTTP 상태 코드 매핑

- **400 Bad Request**: 잘못된 요청, 유효성 검증 실패
- **401 Unauthorized**: 인증 실패
- **404 Not Found**: 리소스를 찾을 수 없음
- **409 Conflict**: 중복된 리소스 생성 시도
- **429 Too Many Requests**: 대기열 용량 초과
- **500 Internal Server Error**: 예상치 못한 서버 에러
- **503 Service Unavailable**: 의존 서비스(DB, Redis) 연결 실패

#### 사용 예시

```typescript
import { ValidationError, NotFoundError } from './middleware/errorHandler';

// 컨트롤러에서 사용
async function getUser(userId: string) {
  if (!userId) {
    throw new ValidationError('User ID is required', 'userId');
  }
  
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError(`User ${userId} not found`);
  }
  
  return user;
}
```

### 2. 재시도 로직 (Task 16.4) ✅

모든 서비스에 Exponential Backoff를 사용한 재시도 유틸리티가 구현되어 있습니다.

#### 재시도 함수

**1. retryWithBackoff** - 기본 재시도 로직

```typescript
import { retryWithBackoff } from './utils/retry';

const result = await retryWithBackoff(
  () => ticketServiceClient.issueTicket(userId),
  {
    maxRetries: 3,              // 최대 재시도 횟수
    initialDelayMs: 1000,       // 초기 대기 시간
    maxDelayMs: 10000,          // 최대 대기 시간
    backoffMultiplier: 2        // 지수 배수
  }
);
```

**2. retryWithCondition** - 조건부 재시도

```typescript
import { retryWithCondition } from './utils/retry';

const result = await retryWithCondition(
  () => databaseQuery(),
  (error) => error.message.includes('temporary'), // 재시도 조건
  { maxRetries: 5 }
);
```

**3. retryWithTimeout** - 타임아웃과 함께 재시도

```typescript
import { retryWithTimeout } from './utils/retry';

const result = await retryWithTimeout(
  () => externalService.call(),
  5000,  // 5초 타임아웃
  { maxRetries: 3 }
);
```

#### 재시도 가능한 에러

다음 에러들은 자동으로 재시도됩니다:

- **네트워크 에러**: `ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`, `EAI_AGAIN`
- **HTTP 5xx 에러**: 서버 에러 (500-599)
- **타임아웃 에러**: 메시지에 'timeout' 포함

#### Exponential Backoff

재시도 간 대기 시간은 지수적으로 증가합니다:

```
1차 재시도: 1000ms
2차 재시도: 2000ms (1000 * 2)
3차 재시도: 4000ms (2000 * 2)
최대: 10000ms
```

#### 적용된 위치

**Queue Service**
- `ticketServiceClient.issueTicket()` - Ticket Service 호출 시 재시도

**Database Module**
- `checkConnection()` - 데이터베이스 연결 확인 시 재시도
- `query()` - 데이터베이스 쿼리 실행 시 재시도

**Redis Connection**
- 내장된 `reconnectStrategy`로 자동 재연결

### 3. 헬스 체크 엔드포인트 (Task 16.5) ✅

모든 서비스에 `/health` 엔드포인트가 구현되어 있습니다.

#### Queue Service

```bash
GET http://localhost:3001/health
```

응답:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "queue-service",
  "dependencies": {
    "redis": "connected"
  }
}
```

#### Ticket Service

```bash
GET http://localhost:3002/health
```

응답:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "ticket-service",
  "dependencies": {
    "database": "connected"
  }
}
```

#### User Service

```bash
GET http://localhost:3003/health
```

응답:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "user-service",
  "dependencies": {
    "database": "connected"
  }
}
```

#### 상태 코드

- **200 OK**: 서비스와 모든 의존성이 정상
- **200 OK (degraded)**: 서비스는 정상이지만 일부 의존성 문제
- **503 Service Unavailable**: 서비스 자체에 문제

## 로깅

### 에러 로깅

모든 에러는 자동으로 로깅됩니다:

```typescript
logger.error({
  message: err.message,
  stack: err.stack,
  path: req.path,
  method: req.method,
  timestamp: new Date().toISOString()
});
```

### 요청 로깅

모든 HTTP 요청은 처리 시간과 함께 로깅됩니다:

```typescript
logger.info({
  method: req.method,
  path: req.path,
  statusCode: res.statusCode,
  duration: '123ms',
  timestamp: new Date().toISOString()
});
```

## 테스트

### 재시도 로직 테스트

각 서비스에 재시도 로직 테스트가 포함되어 있습니다:

```bash
# Queue Service
cd services/queue-service
npm test -- retry.test.ts --run

# Ticket Service
cd services/ticket-service
npm test -- retry.test.ts --run

# User Service
cd services/user-service
npm test -- retry.test.ts --run
```

### 테스트 커버리지

- ✅ 첫 시도 성공
- ✅ 재시도 후 성공
- ✅ 재시도 불가능한 에러 즉시 실패
- ✅ 최대 재시도 횟수 초과
- ✅ HTTP 5xx 에러 재시도
- ✅ HTTP 4xx 에러 재시도 안 함
- ✅ Exponential backoff 동작
- ✅ 조건부 재시도
- ✅ 타임아웃과 함께 재시도

## 모범 사례

### 1. 적절한 에러 클래스 사용

```typescript
// ✅ Good
if (!userId) {
  throw new ValidationError('User ID is required', 'userId');
}

// ❌ Bad
if (!userId) {
  throw new Error('User ID is required');
}
```

### 2. 재시도 로직 적용

```typescript
// ✅ Good - 외부 서비스 호출 시 재시도
const ticket = await retryWithBackoff(
  () => ticketService.issueTicket(userId),
  { maxRetries: 3 }
);

// ❌ Bad - 재시도 없이 직접 호출
const ticket = await ticketService.issueTicket(userId);
```

### 3. 에러 로깅

```typescript
// ✅ Good - 컨텍스트와 함께 로깅
logger.error('Failed to issue ticket', { 
  userId, 
  error: error.message,
  stack: error.stack 
});

// ❌ Bad - 최소한의 정보만 로깅
console.error('Error:', error);
```

### 4. 헬스 체크 활용

```typescript
// ✅ Good - 의존성 상태 확인
const health = {
  status: dbConnected && redisConnected ? 'healthy' : 'degraded',
  dependencies: {
    database: dbConnected ? 'connected' : 'disconnected',
    redis: redisConnected ? 'connected' : 'disconnected'
  }
};

// ❌ Bad - 단순 OK 응답
res.json({ status: 'ok' });
```

## 환경 변수

재시도 로직 관련 환경 변수:

```env
# Redis 재시도 설정
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY_MS=1000

# 데이터베이스 연결 타임아웃
DB_CONNECTION_TIMEOUT=2000
DB_IDLE_TIMEOUT=30000

# Ticket Service URL (Queue Service에서 사용)
TICKET_SERVICE_URL=http://localhost:3002
```

## 트러블슈팅

### 문제: 재시도가 작동하지 않음

**원인**: 에러가 재시도 가능한 에러로 인식되지 않음

**해결**:
```typescript
// 커스텀 재시도 조건 사용
await retryWithCondition(
  () => operation(),
  (error) => {
    // 재시도 조건 명시
    return error.code === 'MY_CUSTOM_ERROR';
  }
);
```

### 문제: 헬스 체크가 항상 503 반환

**원인**: 의존성 연결 확인 실패

**해결**:
1. 데이터베이스/Redis 연결 확인
2. 환경 변수 확인 (`DATABASE_URL`, `REDIS_URL`)
3. 네트워크 연결 확인

### 문제: 에러 로그가 너무 많음

**원인**: 로그 레벨이 너무 낮음

**해결**:
```env
LOG_LEVEL=warn  # info 대신 warn 사용
```

## 요구사항 매핑

- ✅ **요구사항 1.2**: 서비스 간 통신 재시도 (Exponential backoff)
- ✅ **요구사항 9.3**: 적절한 HTTP 상태 코드 반환
- ✅ **요구사항 10.2**: 에러 로깅
- ✅ **요구사항 10.5**: 헬스 체크 엔드포인트

## 참고 자료

- [Express Error Handling](https://expressjs.com/en/guide/error-handling.html)
- [Exponential Backoff](https://en.wikipedia.org/wiki/Exponential_backoff)
- [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
