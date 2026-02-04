# 06. 인프라 상태 확인

[← 05. 인프라 기동](./05-infra-start.md) | [목차](./README.md) | [07. 백엔드 빌드 →](./07-backend-build.md)

---

⏱️ **예상 소요 시간**: 3분

## 목표

각 인프라 서비스가 정상 동작하는지 직접 확인합니다.

---

## 1. PostgreSQL 연결 확인

```bash
# PostgreSQL 컨테이너에 접속하여 연결 테스트
docker exec -it ticketing-postgres psql -U admin -d ticketing -c "SELECT version();"
```

**예상 출력:**
```
                                                     version
------------------------------------------------------------------------------------------------------------------
 PostgreSQL 17.x on ...
(1 row)
```

### 테이블 생성 확인

```bash
docker exec -it ticketing-postgres psql -U admin -d ticketing -c "\dt"
```

**예상 출력:**
```
          List of relations
 Schema |   Name   | Type  | Owner
--------+----------+-------+-------
 public | events   | table | admin
 public | queues   | table | admin
 public | tickets  | table | admin
 public | users    | table | admin
(4 rows)
```

---

## 2. Redis 연결 확인

```bash
# Redis PING 테스트
docker exec -it ticketing-redis redis-cli ping
```

**예상 출력:**
```
PONG
```

### Redis 정보 확인

```bash
docker exec -it ticketing-redis redis-cli info server | head -5
```

**예상 출력:**
```
# Server
redis_version:7.x.x
...
```

---

## 3. RabbitMQ 연결 확인

```bash
# RabbitMQ 상태 확인
docker exec -it ticketing-rabbitmq rabbitmqctl status | head -20
```

**예상 출력:**
```
Status of node rabbit@... ...
Runtime

OS PID: ...
OS: Linux
...
```

### RabbitMQ 큐 목록 확인

```bash
docker exec -it ticketing-rabbitmq rabbitmqctl list_queues
```

**예상 출력 (초기 상태):**
```
Timeout: 60.0 seconds ...
Listing queues for vhost / ...
```

> 💡 아직 큐가 없는 것이 정상입니다. 서비스 기동 후 생성됩니다.

---

## 4. 웹 UI 접속 확인

### Redis Commander

브라우저에서 접속:
```
http://localhost:8081
```

Redis 데이터를 시각적으로 확인할 수 있는 UI가 표시됩니다.

### RabbitMQ Management

브라우저에서 접속:
```
http://localhost:15672
```

**로그인 정보:**
- Username: `admin`
- Password: `password`

대시보드가 표시되면 정상입니다.

---

## 5. 네트워크 확인

컨테이너들이 같은 네트워크에 있는지 확인합니다:

```bash
docker network inspect ticketing-network --format '{{range .Containers}}{{.Name}} {{end}}'
```

**예상 출력:**
```
ticketing-postgres ticketing-redis ticketing-rabbitmq ticketing-redis-commander
```

---

## ✅ 체크포인트

다음을 확인하세요:

- [ ] PostgreSQL: `SELECT version()` 쿼리가 성공한다
- [ ] PostgreSQL: 4개 테이블(events, queues, tickets, users)이 존재한다
- [ ] Redis: `PING` 명령에 `PONG` 응답이 온다
- [ ] RabbitMQ: `rabbitmqctl status`가 정상 출력된다
- [ ] Redis Commander UI (http://localhost:8081) 접속 가능
- [ ] RabbitMQ Management UI (http://localhost:15672) 접속 가능

---

[← 05. 인프라 기동](./05-infra-start.md) | [목차](./README.md) | [07. 백엔드 빌드 →](./07-backend-build.md)
