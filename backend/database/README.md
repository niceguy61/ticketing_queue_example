# Database Module

PostgreSQL 데이터베이스 연결 및 스키마 관리 모듈입니다.

## 구성 요소

### 1. Schema (schema.sql)
- **users 테이블**: 사용자 정보 저장
- **sessions 테이블**: 사용자 세션 관리
- **tickets 테이블**: 티켓 정보 저장
- 인덱스 및 트리거 자동 생성

### 2. Connection Module (connection.ts)
- PostgreSQL 연결 풀 관리
- 환경 변수 기반 설정
- 연결 상태 확인 기능
- 스키마 초기화 기능

## 환경 변수 설정

`.env` 파일을 생성하고 다음 중 하나의 방식으로 설정하세요:

### 방법 1: 연결 문자열 사용 (권장)
```bash
DATABASE_URL=postgresql://admin:password@localhost:5432/ticketing
```

### 방법 2: 개별 파라미터 사용
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ticketing
DB_USER=admin
DB_PASSWORD=password
```

### 추가 설정 (선택사항)
```bash
DB_POOL_MAX=10
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000
```

## 사용 방법

### 데이터베이스 연결 초기화
```typescript
import { initializePool, initializeSchema } from './connection';

// 연결 풀 초기화
initializePool();

// 스키마 초기화 (테이블 생성)
await initializeSchema();
```

### 쿼리 실행
```typescript
import { query } from './connection';

// 사용자 조회
const users = await query('SELECT * FROM users WHERE username = $1', ['testuser']);

// 사용자 생성
const result = await query(
  'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING user_id',
  ['newuser', 'user@example.com']
);
```

### 연결 상태 확인
```typescript
import { checkConnection } from './connection';

const isConnected = await checkConnection();
if (isConnected) {
  console.log('Database connection is healthy');
}
```

### 트랜잭션 사용
```typescript
import { getClient } from './connection';

const client = await getClient();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO users (username, email) VALUES ($1, $2)', ['user1', 'user1@example.com']);
  await client.query('INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)', [userId, token, expiresAt]);
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

## 테스트

### 단위 테스트 실행
```bash
npm test
```

### 속성 기반 테스트
- **connection.test.ts**: 환경 변수 설정 처리 검증 (Property 3)
- **persistence.test.ts**: 데이터 영속성 및 복구 검증 (Property 16)

**참고**: persistence.test.ts는 실제 데이터베이스 연결이 필요합니다. 데이터베이스가 설정되지 않은 경우 테스트는 자동으로 스킵됩니다.

## 요구사항 검증

- ✅ 요구사항 2.5: 환경 변수를 통한 설정 주입
- ✅ 요구사항 11.2: 티켓 정보를 영구 저장소에 저장
- ✅ 요구사항 11.3: 사용자 정보를 영구 저장소에 저장
- ✅ 요구사항 11.4: 서비스 재시작 시 저장된 데이터 복구
- ✅ 요구사항 11.5: 데이터베이스 연결 설정을 환경 변수로 관리

## Docker Compose와 함께 사용

`docker-compose.yml`에서 PostgreSQL 서비스와 함께 사용:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ticketing
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

  your-service:
    environment:
      - DATABASE_URL=postgresql://admin:password@postgres:5432/ticketing
```
