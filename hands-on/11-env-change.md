# 11. 환경변수 변경 및 재배포

[← 10. 프론트엔드 기동](./10-frontend-start.md) | [목차](./README.md) | [12. Redis 모니터링 →](./12-monitor-redis.md)

---

⏱️ **예상 소요 시간**: 5분

## 목표

환경변수를 변경하고 서비스를 올바르게 재배포하는 방법을 학습합니다.

---

## 1. 환경변수 변경이 필요한 경우

### 주요 변경 시나리오

| 변경 사항 | 영향 범위 | 재배포 방법 |
|-----------|-----------|-------------|
| `QUEUE_MODE` 변경 | Queue Service | `--force-recreate` |
| `QUEUE_PROVIDER` 변경 | Queue Service | `--force-recreate` + 프로필 |
| 포트 변경 | 해당 서비스 | `--force-recreate` |
| 프론트엔드 API URL | Frontend | `--build` |

---

## 2. Queue Mode 변경 (Simple ↔ Advanced)

### 현재 모드 확인

```bash
# API로 현재 모드 확인
curl -s http://localhost:3001/api/queue/mode | jq
```

**예상 출력:**
```json
{
  "mode": "simple"
}
```

### Simple → Advanced 모드 변경

#### 1단계: .env 파일 수정

```bash
# .env 파일에서 QUEUE_MODE 변경
# QUEUE_MODE=simple
QUEUE_MODE=advanced
```

#### 2단계: Queue Service 재시작

```bash
# 환경변수 변경을 위해 컨테이너 강제 재생성
docker compose up -d --force-recreate queue-service
```

> ⚠️ **중요**: 단순히 `docker compose restart`로는 환경변수 변경이 반영되지 않습니다!

#### 3단계: 변경 확인

```bash
# 변경된 모드 확인
curl -s http://localhost:3001/api/queue/mode | jq

# 로그에서 모드 확인
docker compose logs --tail=10 queue-service | grep "mode"
```

**예상 출력:**
```
ticketing-queue-service  | info: Queue processor started {"mode":"advanced"}
```

---

## 3. Queue Provider 변경 (Redis ↔ RabbitMQ ↔ Kafka ↔ SQS)

### Redis → RabbitMQ 변경

#### 1단계: .env 파일 수정

```bash
# .env 파일에서 QUEUE_PROVIDER 변경
# QUEUE_PROVIDER=redis
QUEUE_PROVIDER=rabbitmq
```

#### 2단계: RabbitMQ 프로필로 재시작

```bash
# 기존 서비스 중지
docker compose down

# RabbitMQ 포함하여 재시작
docker compose --profile rabbitmq up -d
```

#### 3단계: 연결 확인

```bash
# Queue Service 로그에서 RabbitMQ 연결 확인
docker compose logs --tail=10 queue-service | grep -i rabbit
```

**예상 출력:**
```
ticketing-queue-service  | info: RabbitMQ Adapter initialized
ticketing-queue-service  | info: RabbitMQ connected successfully
```

### Kafka로 변경

#### 1단계: .env 파일 수정

```bash
# .env 파일에서 QUEUE_PROVIDER 변경
QUEUE_PROVIDER=kafka
KAFKA_BROKERS=kafka:29092
```

#### 2단계: Kafka 프로필로 재시작

```bash
# 기존 서비스 중지
docker compose down

# Kafka 포함하여 재시작 (시간이 오래 걸림)
docker compose --profile kafka up -d
```

#### 3단계: 연결 확인

```bash
# Kafka 연결 확인
docker compose logs --tail=10 queue-service | grep -i kafka
```

### LocalStack SQS로 변경

#### 1단계: .env 파일 수정

```bash
# .env 파일에서 SQS 설정
QUEUE_PROVIDER=sqs
AWS_REGION=us-east-1
AWS_ENDPOINT=http://localstack:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

#### 2단계: LocalStack 프로필로 재시작

```bash
# 기존 서비스 중지
docker compose down

# LocalStack 포함하여 재시작
docker compose --profile localstack up -d
```

#### 3단계: 연결 확인

```bash
# SQS 연결 확인
docker compose logs --tail=10 queue-service | grep -i sqs
```

---

## 4. 프론트엔드 환경변수 변경

프론트엔드는 **빌드 시점**에 환경변수가 번들에 포함되므로 **이미지 재빌드**가 필요합니다.

### API URL 변경

#### 1단계: .env 파일 수정

```bash
# 프론트엔드 API URL 변경
VITE_QUEUE_SERVICE_URL=http://localhost:3001
VITE_TICKET_SERVICE_URL=http://localhost:3002
VITE_USER_SERVICE_URL=http://localhost:3003
```

#### 2단계: 프론트엔드 재빌드

```bash
# 이미지 재빌드 필수
docker compose up -d --build frontend
```

> ⚠️ **주의**: 프론트엔드는 `--force-recreate`만으로는 환경변수 변경이 반영되지 않습니다!

---

## 5. 포트 변경

### 서비스 포트 변경

#### 1단계: .env 파일 수정

```bash
# Queue Service 포트 변경
QUEUE_SERVICE_PORT=3011
```

#### 2단계: 해당 서비스 재시작

```bash
# 포트 변경을 위해 컨테이너 재생성
docker compose up -d --force-recreate queue-service
```

#### 3단계: 포트 확인

```bash
# 변경된 포트 확인
docker compose ps queue-service
```

**예상 출력:**
```
NAME                     STATUS                   PORTS
ticketing-queue-service  Up (healthy)             0.0.0.0:3011->3011/tcp
```

---

## 6. 전체 재시작 (확실한 방법)

환경변수 변경이 복잡하거나 확실하지 않을 때:

```bash
# 모든 서비스 중지 및 볼륨 제거
docker compose down -v

# 이미지 재빌드 포함 전체 재시작
docker compose up -d --build
```

> 💡 이 방법은 확실하지만 시간이 오래 걸리고 데이터가 초기화됩니다.

---

## 7. 환경변수 변경 확인 방법

### 컨테이너 내부 환경변수 확인

```bash
# Queue Service 환경변수 확인
docker exec ticketing-queue-service printenv | grep QUEUE

# 특정 환경변수 확인
docker exec ticketing-queue-service printenv QUEUE_MODE
```

### API로 설정 확인

```bash
# Queue 모드 확인
curl -s http://localhost:3001/api/queue/mode | jq

# 로비 큐 상태 확인 (설정 반영 여부)
curl -s http://localhost:3001/api/queue/lobby/status | jq
```

---

## 8. 자주 발생하는 문제

### 문제 1: 환경변수 변경이 반영되지 않음

**증상**: `.env` 파일을 수정했는데 이전 값으로 동작

**해결책**:
```bash
# restart 대신 --force-recreate 사용
docker compose up -d --force-recreate queue-service
```

### 문제 2: 프론트엔드 API URL이 변경되지 않음

**증상**: API URL을 변경했는데 이전 URL로 요청

**해결책**:
```bash
# 프론트엔드는 반드시 --build 옵션 사용
docker compose up -d --build frontend
```

### 문제 3: 프로필 변경 후 서비스가 시작되지 않음

**증상**: Kafka나 LocalStack으로 변경 후 Queue Service 실패

**해결책**:
```bash
# 의존 서비스가 먼저 시작되었는지 확인
docker compose ps

# 의존 서비스가 healthy 상태인지 확인
docker compose ps | grep healthy
```

---

## 9. 실습: Simple → Advanced 모드 변경

실제로 모드를 변경해보겠습니다:

### 1단계: 현재 상태 확인

```bash
curl -s http://localhost:3001/api/queue/mode | jq
```

### 2단계: .env 파일 수정

```bash
# QUEUE_MODE=simple을 QUEUE_MODE=advanced로 변경
```

### 3단계: Queue Service 재시작

```bash
docker compose up -d --force-recreate queue-service
```

### 4단계: 변경 확인

```bash
# 30초 정도 대기 후 확인
sleep 30
curl -s http://localhost:3001/api/queue/mode | jq
```

### 5단계: Advanced 모드 기능 확인

```bash
# 티켓 이벤트 목록 확인 (Advanced 모드에서만 사용)
curl -s http://localhost:3001/api/events | jq
```

---

## ✅ 체크포인트

다음을 확인하세요:

- [ ] 환경변수 변경 시 `--force-recreate` 옵션을 사용한다
- [ ] 프론트엔드 변경 시 `--build` 옵션을 사용한다
- [ ] 프로필 변경 시 `docker compose down` 후 새 프로필로 시작한다
- [ ] 변경 후 API나 로그로 설정이 반영되었는지 확인한다

---

[← 10. 프론트엔드 기동](./10-frontend-start.md) | [목차](./README.md) | [12. Redis 모니터링 →](./12-monitor-redis.md)