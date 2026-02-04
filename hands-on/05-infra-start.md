# 05. 인프라 서비스 기동

[← 04. 환경변수 설정](./04-env-setup.md) | [목차](./README.md) | [06. 인프라 확인 →](./06-infra-verify.md)

---

⏱️ **예상 소요 시간**: 3분

## 목표

PostgreSQL, Redis, RabbitMQ 인프라 서비스를 Docker로 기동합니다.

---

## 1. 인프라 서비스 시작

프로젝트 루트 디렉토리에서 실행합니다:

```bash
# 인프라 서비스만 시작 (백그라운드)
docker compose up -d postgres redis rabbitmq redis-commander
```

**예상 출력:**
```
[+] Running 5/5
 ✔ Network ticketing-network        Created
 ✔ Container ticketing-postgres     Started
 ✔ Container ticketing-redis        Started
 ✔ Container ticketing-rabbitmq     Started
 ✔ Container ticketing-redis-commander Started
```

---

## 2. 컨테이너 상태 확인

```bash
docker compose ps
```

**예상 출력:**
```
NAME                        STATUS                   PORTS
ticketing-postgres          Up (healthy)             0.0.0.0:5432->5432/tcp
ticketing-redis             Up (healthy)             0.0.0.0:6379->6379/tcp
ticketing-rabbitmq          Up (healthy)             0.0.0.0:15672->15672/tcp, 0.0.0.0:15673->5672/tcp
ticketing-redis-commander   Up                       0.0.0.0:8081->8081/tcp
```

> ⚠️ STATUS가 `Up (health: starting)`이면 잠시 대기 후 다시 확인하세요.

---

## 3. 헬스체크 대기

모든 서비스가 healthy 상태가 될 때까지 대기합니다:

```bash
# 헬스체크 상태 확인 (healthy가 될 때까지 반복)
docker compose ps --format "table {{.Name}}\t{{.Status}}"
```

**모든 서비스가 `Up (healthy)`가 되면** 다음 단계로 진행합니다.

---

## 4. 이미지 다운로드 확인

처음 실행 시 이미지를 다운로드합니다:

```bash
docker images | grep -E "postgres|redis|rabbitmq"
```

**예상 출력:**
```
postgres                      17-alpine    ...   ~240MB
redis                         7-alpine     ...   ~40MB
rabbitmq                      3.12-management-alpine  ...   ~180MB
rediscommander/redis-commander latest      ...   ~120MB
```

---

## ✅ 체크포인트

다음을 확인하세요:

- [ ] `docker compose ps`에서 4개 컨테이너가 보인다
- [ ] postgres, redis, rabbitmq 상태가 `Up (healthy)`이다
- [ ] 오류 메시지 없이 정상 시작되었다

---

[← 04. 환경변수 설정](./04-env-setup.md) | [목차](./README.md) | [06. 인프라 확인 →](./06-infra-verify.md)
