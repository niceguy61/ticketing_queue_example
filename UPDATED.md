# 업데이트 로그

이 문서는 프로젝트에 추가된 주요 변경 사항을 기록합니다.

---

## 2026-02-08

### 환경 변수 동기화 기능 추가

**문제**: `.env` 파일에서 `QUEUE_MODE`, `LOBBY_CAPACITY`, `PROCESSING_RATE` 등을 변경한 후 `docker compose up -d --force-recreate queue-service`로 재기동해도 Redis에 저장된 기존 설정이 유지되어 환경 변수 변경이 반영되지 않는 문제

**해결**:
- `QueueConfigManager`에 `syncFromEnv()` 메서드 추가
- 서비스 시작 시 Redis에 설정이 이미 존재하면 환경 변수 값으로 동기화
- 기존 `ticketEvents` 데이터는 보존하면서 환경 변수만 업데이트

**변경 파일**:
- `backend/services/queue-service/src/index.ts`
- `backend/services/queue-service/src/queue/queueConfig.ts`

**참고**: [hands-on/11-env-change.md](./hands-on/11-env-change.md)

---

### 모니터링을 위한 딜레이 기능 추가

**목적**: Redis, RabbitMQ, Kafka 등의 모니터링 도구에서 대기열 및 메시지 큐의 변화를 관찰할 수 있도록 처리 속도를 조절

**추가된 환경 변수**:

1. **TICKET_QUEUE_DELAY_MS** (기본값: 10000ms = 10초)
   - 티켓 대기열(2단 큐)에서 사용자를 꺼낼 때 적용되는 딜레이
   - Redis의 `ticket:queue:{eventId}` 크기 변화를 관찰 가능
   - 0으로 설정하면 딜레이 없음

2. **TICKET_ISSUE_DELAY_MS** (기본값: 5000ms = 5초)
   - 메시지 큐에서 티켓 발급 메시지를 처리할 때 적용되는 딜레이
   - RabbitMQ/SQS/Kafka의 `ticket-issue-queue`에 메시지가 쌓이는 것을 관찰 가능
   - 0으로 설정하면 딜레이 없음

**처리 흐름**:
```
사용자 → 티켓 큐 진입 
→ [TICKET_QUEUE_DELAY_MS 대기] 
→ 메시지 발행 (메시지 큐에 쌓임) 
→ [TICKET_ISSUE_DELAY_MS 대기] 
→ 티켓 발급
```

**변경 파일**:
- `backend/services/queue-service/src/services/queueProcessor.ts`
- `.env`
- `docker-compose.yml`

**사용 예시**:
```bash
# .env 파일에서 딜레이 조정
TICKET_QUEUE_DELAY_MS=10000  # 10초
TICKET_ISSUE_DELAY_MS=5000   # 5초

# 딜레이 비활성화
TICKET_QUEUE_DELAY_MS=0
TICKET_ISSUE_DELAY_MS=0

# 재기동
docker compose up -d --force-recreate queue-service
```

**모니터링 도구**:
- Redis: Redis Commander (http://localhost:8081)
- RabbitMQ: Management UI (http://localhost:15672)
- Kafka: Kafka UI (http://localhost:8082)

**참고**: [hands-on/12-monitor-redis.md](./hands-on/12-monitor-redis.md), [hands-on/13-monitor-rabbitmq.md](./hands-on/13-monitor-rabbitmq.md)

---
