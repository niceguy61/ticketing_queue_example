# 11. Redis 모니터링

[← 10. 프론트엔드 기동](./10-frontend-start.md) | [목차](./README.md) | [12. RabbitMQ 모니터링 →](./12-monitor-rabbitmq.md)

---

⏱️ **예상 소요 시간**: 3분

## 목표

Redis Commander를 사용하여 Redis 데이터를 모니터링합니다.

---

## 1. Redis Commander 접속

브라우저에서 접속:

```
http://localhost:8081
```

**화면 구성:**
- 좌측: 데이터베이스 및 키 목록
- 우측: 선택한 키의 상세 정보

---

## 2. 대기열 데이터 확인

### 키 목록 확인

좌측 패널에서 `db0`을 클릭하면 저장된 키 목록이 표시됩니다.

**대기열 관련 키 패턴:**
- `lobby:queue` - 로비 대기열 (ZSET)
- `queue:*` - 이벤트별 대기열
- `config:*` - 설정 정보

### ZSET 데이터 확인

대기열은 Redis ZSET(Sorted Set)으로 저장됩니다:

1. `lobby:queue` 키 클릭
2. Type: `zset` 확인
3. Members: 대기 중인 사용자 목록

---

## 3. CLI로 Redis 데이터 확인

### 모든 키 조회

```bash
docker exec -it ticketing-redis redis-cli keys '*'
```

### 대기열 크기 확인

```bash
# lobby:queue의 멤버 수 (대기 인원)
docker exec -it ticketing-redis redis-cli zcard lobby:queue
```

### 대기열 멤버 조회

```bash
# 대기열의 모든 멤버 조회 (score 포함)
docker exec -it ticketing-redis redis-cli zrange lobby:queue 0 -1 withscores
```

### 특정 사용자 순위 확인

```bash
# 사용자의 대기 순위 (0부터 시작)
docker exec -it ticketing-redis redis-cli zrank lobby:queue "<user-id>"
```

---

## 4. 실시간 모니터링

### Redis MONITOR 명령

실시간으로 Redis 명령어를 모니터링합니다:

```bash
docker exec -it ticketing-redis redis-cli monitor
```

**출력 예시:**
```
1234567890.123456 [0 172.18.0.5:54321] "ZADD" "lobby:queue" "1234567890" "user-123"
1234567890.234567 [0 172.18.0.5:54321] "ZRANK" "lobby:queue" "user-123"
```

> 💡 `Ctrl+C`로 종료

### Redis INFO 명령

Redis 서버 상태 확인:

```bash
# 메모리 사용량
docker exec -it ticketing-redis redis-cli info memory | grep used_memory_human

# 연결된 클라이언트 수
docker exec -it ticketing-redis redis-cli info clients | grep connected_clients

# 키 통계
docker exec -it ticketing-redis redis-cli info keyspace
```

---

## 5. 테스트 데이터 생성

대기열에 테스트 데이터를 추가해봅니다:

```bash
# 테스트 사용자 3명 추가
docker exec -it ticketing-redis redis-cli zadd lobby:queue $(date +%s)001 "test-user-1"
docker exec -it ticketing-redis redis-cli zadd lobby:queue $(date +%s)002 "test-user-2"
docker exec -it ticketing-redis redis-cli zadd lobby:queue $(date +%s)003 "test-user-3"

# 대기열 확인
docker exec -it ticketing-redis redis-cli zrange lobby:queue 0 -1 withscores
```

**Redis Commander에서 새로고침**하면 추가된 데이터가 표시됩니다.

### 테스트 데이터 삭제

```bash
# 테스트 데이터 삭제
docker exec -it ticketing-redis redis-cli zrem lobby:queue "test-user-1" "test-user-2" "test-user-3"
```

---

## 6. 주요 Redis 명령어 정리

| 명령어 | 설명 |
|--------|------|
| `KEYS *` | 모든 키 조회 |
| `ZCARD <key>` | ZSET 멤버 수 |
| `ZRANGE <key> 0 -1` | ZSET 모든 멤버 조회 |
| `ZRANK <key> <member>` | 멤버의 순위 |
| `ZADD <key> <score> <member>` | 멤버 추가 |
| `ZREM <key> <member>` | 멤버 삭제 |
| `INFO` | 서버 정보 |
| `MONITOR` | 실시간 명령 모니터링 |

---

## ✅ 체크포인트

다음을 확인하세요:

- [ ] Redis Commander (http://localhost:8081) 접속 가능
- [ ] `keys '*'` 명령으로 키 목록 조회 가능
- [ ] ZSET 데이터 구조 이해 (score 기반 정렬)

---

[← 10. 프론트엔드 기동](./10-frontend-start.md) | [목차](./README.md) | [12. RabbitMQ 모니터링 →](./12-monitor-rabbitmq.md)
