# 09. 백엔드 동작 확인

[← 08. 백엔드 기동](./08-backend-start.md) | [목차](./README.md) | [10. 프론트엔드 기동 →](./10-frontend-start.md)

---

⏱️ **예상 소요 시간**: 3분

## 목표

각 백엔드 서비스의 Health API와 기본 API를 호출하여 정상 동작을 확인합니다.

---

## 1. Health Check API

### User Service

```bash
curl -s http://localhost:3003/health | jq
```

jq library 설치 안되어 있으면

```bash
brew install jq
```

**예상 출력:**
```json
{
  "status": "ok",
  "service": "user-service",
  "timestamp": "2024-..."
}
```

### Ticket Service

```bash
curl -s http://localhost:3002/health | jq
```

**예상 출력:**
```json
{
  "status": "ok",
  "service": "ticket-service",
  "timestamp": "2024-..."
}
```

### Queue Service

```bash
curl -s http://localhost:3001/health | jq
```

**예상 출력:**
```json
{
  "status": "ok",
  "service": "queue-service",
  "timestamp": "2024-..."
}
```

> 💡 `jq`가 없으면 `| jq` 부분을 제거하고 실행하세요.

---

## 2. User Service API 테스트

### 사용자 등록

```bash
curl -s -X POST http://localhost:3003/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "email": "test@example.com"}' | jq
```

**예상 출력:**
```json
{
  "userId": "bf000...",
  "sessionToken": "..."
}
```

### 사용자 조회

```bash
# 위에서 생성된 user_id로 조회
curl -s http://localhost:3003/api/users/<user_id> | jq
```

---

## 3. Ticket Service API 테스트

### 사용자 티켓 조회

```bash
# 특정 사용자의 티켓 목록 조회
curl -s http://localhost:3002/api/tickets/user/<user_id> | jq
```

**예상 출력:**
```json
{
  "success": true,
  "data": []
}
```

---

## 4. Queue Service API 테스트

### 큐 모드 조회

```bash
curl -s http://localhost:3001/api/queue/mode | jq
```

**예상 출력:**
```json
{
  "success": true,
  "data": {
    "mode": "simple"
  }
}
```

> 💡 기본값은 `simple` 모드입니다. `advanced` 모드를 사용하려면 `.env`에서 `QUEUE_MODE=advanced`로 설정하세요.

### 로비 대기열 상태 조회

```bash
curl -s http://localhost:3001/api/queue/lobby/status | jq
```

**예상 출력:**
```json
{
  "success": true,
  "data": {
    "queueSize": 0,
    "capacity": 1,
    "processingRate": 10
  }
}
```

---

## 5. 서비스 간 통신 확인

Queue Service가 Ticket Service와 통신하는지 확인:

```bash
# Queue Service 로그에서 Ticket Service 연결 확인
docker compose logs queue-service | grep -i "ticket"
```

---

## 6. 간단한 통합 테스트

### 대기열 진입 테스트

```bash
# 1. 사용자 생성 (이미 생성했다면 생략)
USER_RESPONSE=$(curl -s -X POST http://localhost:3003/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"username": "queuetest", "email": "queue@test.com"}')

echo "Response: $USER_RESPONSE"

# 2. user_id 추출
USER_ID=$(echo $USER_RESPONSE | jq -r '.userId')
echo "Created User ID: $USER_ID"

# 3. 대기열 진입
curl -s -X POST http://localhost:3001/api/queue/lobby/join \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\"}" | jq
```

**예상 출력:**
```json
{
  "success": true,
  "data": {
    "position": 1,
    "estimatedWaitTime": "..."
  }
}
```

---

## ✅ 체크포인트

다음을 확인하세요:

- [ ] 3개 서비스의 `/health` API가 모두 `"status": "ok"` 반환
- [ ] User Service: 사용자 생성 API 정상 동작
- [ ] Ticket Service: 티켓 목록 조회 API 정상 동작
- [ ] Queue Service: 대기열 상태 조회 API 정상 동작

---

[← 08. 백엔드 기동](./08-backend-start.md) | [목차](./README.md) | [10. 프론트엔드 기동 →](./10-frontend-start.md)
