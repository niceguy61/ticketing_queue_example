# 08. 백엔드 서비스 기동

[← 07. 백엔드 빌드](./07-backend-build.md) | [목차](./README.md) | [09. 백엔드 확인 →](./09-backend-verify.md)

---

⏱️ **예상 소요 시간**: 2분

## 목표

빌드된 백엔드 서비스(User, Ticket, Queue)를 기동합니다.

---

## 1. 백엔드 서비스 시작

```bash
# 백엔드 서비스 시작 (백그라운드)
docker compose up -d user-service ticket-service queue-service
```

**예상 출력:**
```
[+] Running 3/3
 ✔ Container ticketing-user-service    Started
 ✔ Container ticketing-ticket-service  Started
 ✔ Container ticketing-queue-service   Started
```

---

## 2. 서비스 상태 확인

```bash
docker compose ps
```

**예상 출력:**
```
NAME                          STATUS                   PORTS
ticketing-postgres            Up (healthy)             0.0.0.0:5432->5432/tcp
ticketing-redis               Up (healthy)             0.0.0.0:6379->6379/tcp
ticketing-rabbitmq            Up (healthy)             0.0.0.0:15672->15672/tcp, ...
ticketing-redis-commander     Up                       0.0.0.0:8081->8081/tcp
ticketing-user-service        Up (healthy)             0.0.0.0:3003->3003/tcp
ticketing-ticket-service      Up (healthy)             0.0.0.0:3002->3002/tcp
ticketing-queue-service       Up (healthy)             0.0.0.0:3001->3001/tcp
```

---

## 3. 헬스체크 대기

서비스가 완전히 시작될 때까지 대기합니다:

```bash
# 상태가 healthy가 될 때까지 확인
watch -n 2 'docker compose ps --format "table {{.Name}}\t{{.Status}}"'
```

> 💡 `Ctrl+C`로 watch 종료

또는 수동으로 확인:

```bash
# 10초 간격으로 확인
docker compose ps
```

**모든 서비스가 `Up (healthy)`가 되면** 다음 단계로 진행합니다.

---

## 4. 시작 순서 확인

서비스는 의존성에 따라 순서대로 시작됩니다:

```
1. postgres, redis, rabbitmq (인프라)
      ↓
2. user-service, ticket-service (postgres 의존)
      ↓
3. queue-service (redis, postgres, ticket-service, rabbitmq 의존)
```

---

## 5. 시작 실패 시 로그 확인

서비스가 시작되지 않으면:

```bash
# 특정 서비스 로그 확인
docker compose logs user-service
docker compose logs ticket-service
docker compose logs queue-service
```

**자주 발생하는 문제:**
- `Connection refused`: 의존 서비스가 아직 준비되지 않음 → 잠시 대기
- `ECONNREFUSED`: DB/Redis 연결 실패 → 인프라 서비스 상태 확인

---

## ✅ 체크포인트

다음을 확인하세요:

- [ ] 3개 백엔드 서비스가 모두 시작되었다
- [ ] 모든 서비스 상태가 `Up (healthy)`이다
- [ ] 포트 3001, 3002, 3003이 PORTS 열에 표시된다

---

[← 07. 백엔드 빌드](./07-backend-build.md) | [목차](./README.md) | [09. 백엔드 확인 →](./09-backend-verify.md)
