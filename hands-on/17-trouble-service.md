# 17. 문제 해결: 서비스 기동 문제

[← 16. 네트워크 문제](./16-trouble-network.md) | [목차](./README.md) | [18. 정리 →](./18-cleanup.md)

---

## 서비스 시작 실패

### 증상: 컨테이너가 계속 재시작됨

```bash
docker compose ps
# STATUS: Restarting (1) 5 seconds ago
```

### 해결 방법

1. **로그 확인**
   ```bash
   docker compose logs queue-service
   ```

2. **일반적인 원인**
   - 환경변수 누락
   - 의존 서비스 미시작
   - 포트 충돌
   - 코드 에러

---

## 데이터베이스 연결 실패

### 증상: "ECONNREFUSED" 또는 "Connection refused to postgres"

### 해결 방법

1. **PostgreSQL 상태 확인**
   ```bash
   docker compose ps postgres
   # STATUS가 healthy인지 확인
   ```

2. **PostgreSQL 로그 확인**
   ```bash
   docker compose logs postgres
   ```

3. **연결 테스트**
   ```bash
   docker exec -it ticketing-postgres psql -U admin -d ticketing -c "SELECT 1"
   ```

4. **DATABASE_URL 환경변수 확인**
   ```bash
   # .env 파일 확인
   cat .env | grep DATABASE_URL
   
   # 올바른 형식:
   # postgresql://admin:password@postgres:5432/ticketing
   ```

5. **PostgreSQL 재시작**
   ```bash
   docker compose restart postgres
   # healthy 될 때까지 대기 후 서비스 재시작
   docker compose restart user-service ticket-service queue-service
   ```

---

## Redis 연결 실패

### 증상: "Redis connection failed" 또는 "ECONNREFUSED"

### 해결 방법

1. **Redis 상태 확인**
   ```bash
   docker compose ps redis
   docker exec -it ticketing-redis redis-cli ping
   ```

2. **REDIS_URL 환경변수 확인**
   ```bash
   # 올바른 형식:
   # redis://redis:6379
   ```

3. **Redis 재시작**
   ```bash
   docker compose restart redis
   docker compose restart queue-service
   ```

---

## RabbitMQ 연결 실패

### 증상: "AMQP connection failed"

### 해결 방법

1. **RabbitMQ 상태 확인**
   ```bash
   docker compose ps rabbitmq
   docker exec -it ticketing-rabbitmq rabbitmqctl status
   ```

2. **RABBITMQ_URL 환경변수 확인**
   ```bash
   # 올바른 형식:
   # amqp://admin:password@rabbitmq:5672
   ```

3. **RabbitMQ 재시작**
   ```bash
   docker compose restart rabbitmq
   docker compose restart queue-service
   ```

---

## 의존성 순서 문제

### 증상: 서비스가 의존 서비스보다 먼저 시작되어 실패

### 해결 방법

1. **인프라 먼저 시작**
   ```bash
   # 1단계: 인프라
   docker compose up -d postgres redis rabbitmq
   
   # healthy 확인
   docker compose ps
   
   # 2단계: 백엔드
   docker compose up -d user-service ticket-service
   
   # healthy 확인
   docker compose ps
   
   # 3단계: queue-service
   docker compose up -d queue-service
   
   # 4단계: frontend
   docker compose up -d frontend
   ```

2. **전체 재시작**
   ```bash
   docker compose down
   docker compose up -d
   ```

---

## Health Check 실패

### 증상: STATUS가 "unhealthy"

### 해결 방법

1. **Health Check 로그 확인**
   ```bash
   docker inspect ticketing-queue-service --format '{{json .State.Health}}' | jq
   ```

2. **수동으로 Health Check 실행**
   ```bash
   curl http://localhost:3001/health
   ```

3. **서비스 내부에서 확인**
   ```bash
   docker exec -it ticketing-queue-service wget -qO- http://localhost:3001/health
   ```

---

## 환경변수 문제

### 증상: "undefined" 또는 환경변수 관련 에러

### 해결 방법

1. **컨테이너 환경변수 확인**
   ```bash
   docker exec -it ticketing-queue-service env | grep -E "PORT|REDIS|DATABASE"
   ```

2. **.env 파일 확인**
   ```bash
   cat .env
   ```

3. **환경변수 재로드**
   ```bash
   docker compose down
   docker compose up -d
   ```

---

## 메모리 부족

### 증상: 컨테이너가 OOMKilled로 종료

### 해결 방법

1. **컨테이너 상태 확인**
   ```bash
   docker inspect ticketing-queue-service --format '{{.State.OOMKilled}}'
   ```

2. **메모리 사용량 확인**
   ```bash
   docker stats --no-stream
   ```

3. **Docker Desktop 메모리 증가**
   - Settings → Resources → Memory → 6GB 이상

---

## 서비스 완전 재시작

모든 문제 해결이 안 될 때:

```bash
# 1. 모든 것 중지 및 삭제
docker compose down -v

# 2. 이미지 재빌드
docker compose build --no-cache

# 3. 순서대로 시작
docker compose up -d postgres redis rabbitmq redis-commander
sleep 30  # 인프라 준비 대기

docker compose up -d user-service ticket-service
sleep 15  # 서비스 준비 대기

docker compose up -d queue-service
sleep 10

docker compose up -d frontend

# 4. 상태 확인
docker compose ps
```

---

## 유용한 디버깅 명령어

```bash
# 컨테이너 상세 정보
docker inspect ticketing-queue-service

# 컨테이너 내부 쉘 접속
docker exec -it ticketing-queue-service sh

# 실시간 리소스 모니터링
docker stats

# 컨테이너 이벤트 확인
docker events --filter container=ticketing-queue-service

# 컨테이너 프로세스 확인
docker top ticketing-queue-service
```

---

[← 16. 네트워크 문제](./16-trouble-network.md) | [목차](./README.md) | [18. 정리 →](./18-cleanup.md)
