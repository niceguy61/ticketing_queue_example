# 16. 로그 확인

[← 15. SQS 모니터링](./15-monitor-sqs.md) | [목차](./README.md) | [17. Docker 문제 해결 →](./17-trouble-docker.md)

---

⏱️ **예상 소요 시간**: 3분

## 목표

Docker 컨테이너 로그를 확인하고 실시간 모니터링하는 방법을 익힙니다.

---

## 1. 특정 서비스 로그 확인

### 최근 로그 조회

```bash
# Queue Service 로그 (최근 50줄)
docker compose logs --tail=50 queue-service

# Ticket Service 로그
docker compose logs --tail=50 ticket-service

# User Service 로그
docker compose logs --tail=50 user-service
```

### 전체 로그 조회

```bash
# Queue Service 전체 로그
docker compose logs queue-service
```

---

## 2. 실시간 로그 모니터링

### 단일 서비스

```bash
# Queue Service 실시간 로그
docker compose logs -f queue-service
```

> 💡 `Ctrl+C`로 종료

### 여러 서비스 동시 모니터링

```bash
# 백엔드 서비스 3개 동시 모니터링
docker compose logs -f queue-service ticket-service user-service
```

### 모든 서비스 모니터링

```bash
# 전체 서비스 로그
docker compose logs -f
```

---

## 3. 로그 필터링

### 특정 키워드 검색

```bash
# 에러 로그만 필터링
docker compose logs queue-service | grep -i error

# 경고 로그 필터링
docker compose logs queue-service | grep -i warn

# 특정 API 호출 로그
docker compose logs queue-service | grep "/api/queue"
```

### 시간대별 필터링

```bash
# 최근 10분 로그 (--since 옵션)
docker compose logs --since=10m queue-service

# 특정 시간 이후 로그
docker compose logs --since="2024-01-01T10:00:00" queue-service
```

---

## 4. 인프라 서비스 로그

### PostgreSQL

```bash
# DB 연결 로그
docker compose logs postgres | grep -i connection

# 쿼리 에러 로그
docker compose logs postgres | grep -i error
```

### Redis

```bash
# Redis 로그
docker compose logs redis
```

### RabbitMQ

```bash
# RabbitMQ 로그
docker compose logs rabbitmq | tail -30
```

---

## 5. 로그 레벨 이해

서비스 로그에서 볼 수 있는 레벨:

| 레벨 | 의미 | 예시 |
|------|------|------|
| `ERROR` | 오류 발생 | DB 연결 실패, API 에러 |
| `WARN` | 경고 | 재시도 발생, 느린 쿼리 |
| `INFO` | 정보 | 서비스 시작, API 호출 |
| `DEBUG` | 디버그 | 상세 처리 과정 |

### 로그 레벨 변경

`.env` 파일에서 로그 레벨 조정:

```bash
# .env 파일
LOG_LEVEL=debug  # error, warn, info, debug
```

변경 후 서비스 재시작:

```bash
docker compose restart queue-service
```

---

## 6. 로그 파일 저장

### 파일로 저장

```bash
# 로그를 파일로 저장
docker compose logs queue-service > queue-service.log

# 타임스탬프 포함
docker compose logs -t queue-service > queue-service-with-time.log
```

### 실시간 로그를 파일로 저장

```bash
# 백그라운드에서 로그 저장
docker compose logs -f queue-service > queue-service.log 2>&1 &

# 저장 중지
kill %1
```

---

## 7. 유용한 로그 명령어 조합

### 에러 발생 시 컨텍스트 확인

```bash
# 에러 전후 5줄 포함
docker compose logs queue-service | grep -B5 -A5 "error"
```

### 특정 요청 추적

```bash
# 특정 사용자 ID로 요청 추적
docker compose logs queue-service | grep "user-123"
```

### 로그 통계

```bash
# 에러 발생 횟수
docker compose logs queue-service | grep -c "error"

# 레벨별 로그 수
docker compose logs queue-service | grep -c "INFO"
docker compose logs queue-service | grep -c "ERROR"
```

---

## ✅ 체크포인트

다음을 확인하세요:

- [ ] `docker compose logs <서비스>` 명령으로 로그 조회 가능
- [ ] `-f` 옵션으로 실시간 로그 모니터링 가능
- [ ] `grep`으로 특정 키워드 필터링 가능
- [ ] 에러 로그가 없거나 예상된 에러만 존재

---

[← 15. SQS 모니터링](./15-monitor-sqs.md) | [목차](./README.md) | [17. Docker 문제 해결 →](./17-trouble-docker.md)
