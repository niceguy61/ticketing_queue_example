# Queue Service

대기열 관리를 담당하는 마이크로서비스입니다.

## 구현된 기능

### Task 5: Redis 연결 및 Queue 데이터 구조

#### 5.1 Redis 연결 모듈 (`src/redis/connection.ts`)
- Redis 클라이언트 설정 및 연결 관리
- 환경 변수를 통한 연결 URL 관리
- 자동 재연결 로직 (최대 재시도 횟수 설정)
- 연결 상태 확인 기능 (`healthCheck`, `isConnectionHealthy`)
- 싱글톤 패턴으로 전역 연결 인스턴스 제공

**요구사항**: 11.1 - 대기열 상태를 메모리 또는 데이터베이스에 저장

#### 5.2 Queue 데이터 구조 (`src/queue/queueDataStructure.ts`)
- Redis Sorted Set을 사용한 FIFO 대기열 구현
- 주요 기능:
  - `addToQueue`: 대기열에 사용자 추가 (zadd)
  - `getPosition`: 대기열 위치 조회 (zrank)
  - `removeFromQueue`: 대기열에서 사용자 제거 (zrem)
  - `getQueueSize`: 대기열 크기 조회 (zcard)
  - `getNextUser`: 다음 사용자 조회 (FIFO)
  - `popNextUser`: 다음 사용자 제거 및 반환 (FIFO)
  - `isUserInQueue`: 사용자 존재 여부 확인
  - `getQueuePositionInfo`: 위치 정보 조회

**요구사항**: 6.3, 6.4 - 대기열 생성, 조회, 삭제 기능

#### 5.3 Queue 설정 관리 (`src/queue/queueConfig.ts`)
- Redis Hash를 사용한 대기열 설정 저장/조회
- 주요 기능:
  - 운영 모드 설정 (simple/advanced)
  - 로비 대기열 용량 설정
  - 처리 속도 설정
  - 티켓 이벤트 관리 (Advanced 모드)
  - 기본 설정 초기화

**요구사항**: 6.1, 6.2 - 운영 모드 설정, 용량 설정

## 환경 변수

```env
# Queue Configuration
QUEUE_MODE=simple                # 운영 모드 (simple/advanced)
LOBBY_CAPACITY=1000             # 로비 대기열 최대 용량
PROCESSING_RATE=10              # 초당 처리 인원

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY_MS=1000
```

## 테스트

모든 기능에 대한 단위 테스트가 구현되어 있습니다:

```bash
npm test
```

### 테스트 결과
- ✓ Redis Connection: 4 tests
- ✓ Queue Data Structure: 18 tests
- ✓ Queue Config Manager: 17 tests
- **Total: 39 tests passed**

## 사용 예시

### Redis 연결
```typescript
import redisConnection from './redis/connection';

await redisConnection.connect();
const client = redisConnection.getClient();
```

### 대기열 데이터 구조
```typescript
import { QueueDataStructure } from './queue';

const queueDS = new QueueDataStructure();

// 사용자 추가
await queueDS.addToQueue('lobby:queue', 'user-123');

// 위치 조회
const position = await queueDS.getPosition('lobby:queue', 'user-123');

// 다음 사용자 처리
const nextUser = await queueDS.popNextUser('lobby:queue');
```

### 대기열 설정
```typescript
import { QueueConfigManager } from './queue';

const configManager = new QueueConfigManager();

// 기본 설정 초기화
await configManager.initializeDefaultConfig();

// 모드 설정
await configManager.setMode('advanced');

// 용량 설정
await configManager.setLobbyCapacity(2000);
```

## 다음 단계

Task 6: Queue Service 구현 - Simple 모드
- Express 앱 설정
- Socket.io 서버 설정
- 로비 대기열 API 구현
- 실시간 상태 브로드캐스트


## Message Queue Adapter (하이브리드 아키텍처)

### 개요
이 프로젝트는 **Redis ZSET + Message Queue** 하이브리드 아키텍처를 사용합니다:
- **Redis ZSET**: 대기열 상태 관리, 실시간 위치 조회
- **Message Queue**: 비동기 이벤트 처리, 신뢰성, 확장성

### 구현된 Adapter

#### SQS Adapter (`src/messageQueue/sqsAdapter.ts`)
AWS SQS를 사용한 메시지 큐 구현체입니다. LocalStack과 실제 AWS SQS를 모두 지원합니다.

**주요 기능**:
- 메시지 발행 (publish)
- 메시지 구독 (subscribe) - Long polling 지원
- 큐 크기 조회 (getQueueSize)
- 자동 큐 생성 (createQueue)
- 메시지 확인 (ack) 및 재시도 (nack)

**환경 변수**:
```env
QUEUE_PROVIDER=sqs
AWS_REGION=us-east-1
AWS_ENDPOINT=http://localhost:4566  # LocalStack용
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

#### Queue Adapter Factory (`src/messageQueue/queueAdapterFactory.ts`)
환경 변수에 따라 적절한 Queue Adapter를 생성합니다.

**사용 예시**:
```typescript
import { QueueAdapterFactory } from './messageQueue';

const queueAdapter = QueueAdapterFactory.create();
await queueAdapter.connect();

// 메시지 발행
await queueAdapter.publish('ticket-issue-queue', {
  userId: 'user-123',
  eventId: 'event-456',
  timestamp: Date.now()
});

// 메시지 구독
await queueAdapter.subscribe('ticket-issue-queue', async (message, ack, nack) => {
  try {
    // 메시지 처리
    console.log('Received:', message);
    await ack(); // 처리 성공
  } catch (error) {
    await nack(); // 재시도
  }
});
```

### LocalStack 사용법

LocalStack은 AWS 서비스를 로컬에서 에뮬레이트하는 도구입니다.

**시작**:
```bash
docker-compose up -d localstack
```

**주의사항**:
- Windows 환경에서 LocalStack이 시작되지 않을 수 있습니다 (volume 이슈)
- 이 경우 RabbitMQ 또는 실제 AWS SQS를 사용하세요
- 자세한 내용은 `docs/localstack-guide.md` 참조

### 향후 구현 예정

- RabbitMQ Adapter
- Kafka Adapter
- Redis Adapter (간단한 List 기반)
