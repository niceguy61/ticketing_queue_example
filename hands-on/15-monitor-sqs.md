# 15. SQS 모니터링 (LocalStack)

[← 14. Kafka 모니터링](./14-monitor-kafka.md) | [목차](./README.md) | [16. 로그 확인 →](./16-monitor-logs.md)

---

⏱️ **예상 소요 시간**: 3분

## 목표

LocalStack SQS를 사용하여 메시지 큐를 모니터링합니다.

---

## 1. LocalStack 프로필로 실행

SQS를 사용하려면 `--profile localstack` 옵션으로 실행해야 합니다:

```bash
docker-compose --profile localstack up -d
```

### 환경 변수 설정

`.env` 파일에서 SQS 사용 설정:

```env
QUEUE_PROVIDER=sqs
AWS_REGION=us-east-1
AWS_ENDPOINT=http://localstack:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

---

## 2. LocalStack 상태 확인

LocalStack이 정상 실행되었는지 확인:

```bash
docker compose ps localstack
```

**예상 출력:**
```
NAME                 STATUS                   PORTS
ticketing-localstack Up (healthy)             0.0.0.0:4566->4566/tcp, ...
```

### LocalStack Health Check

```bash
curl -s http://localhost:4566/_localstack/health | jq
```

**예상 출력:**
```json
{
  "services": {
    "sqs": "available"
  }
}
```

---

## 3. SQS 큐 목록 확인

### AWS CLI 사용 (LocalStack 내부)

```bash
docker exec ticketing-localstack awslocal sqs list-queues
```

**예상 출력:**
```json
{
    "QueueUrls": [
        "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/ticket-issue-queue"
    ]
}
```

### 큐 속성 확인

```bash
docker exec ticketing-localstack awslocal sqs get-queue-attributes \
  --queue-url "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/ticket-issue-queue" \
  --attribute-names All
```

**주요 속성:**
- `ApproximateNumberOfMessages`: 큐에 있는 메시지 수
- `ApproximateNumberOfMessagesNotVisible`: 처리 중인 메시지 수
- `CreatedTimestamp`: 큐 생성 시간

---

## 4. 메시지 발행 테스트

### 테스트 메시지 발행

```bash
docker exec ticketing-localstack awslocal sqs send-message \
  --queue-url "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/ticket-issue-queue" \
  --message-body '{"userId": "test-123", "eventId": "test-event", "timestamp": 1234567890}'
```

**예상 출력:**
```json
{
    "MD5OfMessageBody": "bd1cee17806d103ab74e009bd64ba964",
    "MessageId": "1883ad13-391e-4690-9d23-ff879fb65b52"
}
```

### 메시지 수 확인

```bash
docker exec ticketing-localstack awslocal sqs get-queue-attributes \
  --queue-url "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/ticket-issue-queue" \
  --attribute-names ApproximateNumberOfMessages
```

---

## 5. 메시지 처리 확인

### Queue Service 로그 확인

```bash
docker compose logs --tail=10 queue-service
```

**예상 출력:**
```
ticketing-queue-service  | info: Processing ticket issue request {"eventId":"test-event","userId":"test-123"}
ticketing-queue-service  | warn: Event not found, discarding message {"eventId":"test-event","userId":"test-123"}
```

### 메시지 소비 확인

메시지가 처리된 후 큐에서 제거되었는지 확인:

```bash
docker exec ticketing-localstack awslocal sqs get-queue-attributes \
  --queue-url "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/ticket-issue-queue" \
  --attribute-names ApproximateNumberOfMessages
```

**예상 출력:**
```json
{
    "Attributes": {
        "ApproximateNumberOfMessages": "0"
    }
}
```

---

## 6. 메시지 수동 조회 (선택적)

### 메시지 받기 (삭제하지 않고)

```bash
docker exec ticketing-localstack awslocal sqs receive-message \
  --queue-url "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/ticket-issue-queue" \
  --max-number-of-messages 1
```

> ⚠️ **주의**: 이 명령은 메시지를 가져오지만 삭제하지 않습니다. Queue Service와 충돌할 수 있으므로 테스트 목적으로만 사용하세요.

---

## 7. LocalStack Web UI (선택적)

LocalStack Pro 버전을 사용하는 경우 웹 UI에 접속할 수 있습니다:

```
http://localhost:4566/_localstack/cockpit
```

> 💡 Community 버전에서는 웹 UI가 제한적입니다.

---

## 8. SQS vs 다른 큐 시스템 비교

| 특징 | SQS | RabbitMQ | Kafka | Redis |
|------|-----|----------|-------|-------|
| **메시지 순서** | FIFO 큐에서만 보장 | 보장 | 파티션 내에서 보장 | 보장 안됨 |
| **메시지 지속성** | 높음 | 높음 | 높음 | 설정에 따라 |
| **처리량** | 중간 | 높음 | 매우 높음 | 매우 높음 |
| **관리 복잡도** | 낮음 (관리형) | 중간 | 높음 | 낮음 |
| **비용** | 사용량 기반 | 인프라 비용 | 인프라 비용 | 인프라 비용 |

---

## 9. 문제 해결

### SQS 연결 실패

```bash
# LocalStack 상태 확인
docker compose logs localstack

# 네트워크 연결 확인
docker exec ticketing-queue-service curl -s http://localstack:4566/_localstack/health
```

### 메시지가 처리되지 않음

```bash
# Queue Service SQS 폴링 상태 확인
docker compose logs queue-service | grep -i sqs

# SQS 큐 상태 확인
docker exec ticketing-localstack awslocal sqs get-queue-attributes \
  --queue-url "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/ticket-issue-queue" \
  --attribute-names All
```

---

## ✅ 체크포인트

다음을 확인하세요:

- [ ] LocalStack이 `Up (healthy)` 상태이다
- [ ] SQS 큐 `ticket-issue-queue`가 생성되었다
- [ ] 테스트 메시지 발행이 성공한다
- [ ] Queue Service가 메시지를 정상 처리한다
- [ ] 처리된 메시지가 큐에서 제거된다

---

[← 14. Kafka 모니터링](./14-monitor-kafka.md) | [목차](./README.md) | [16. 로그 확인 →](./16-monitor-logs.md)