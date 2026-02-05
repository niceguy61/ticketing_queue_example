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

## 2. Kafka 사용 시 (선택적)

Kafka를 사용하려면 `--profile kafka` 옵션을 추가합니다:

```bash
# Kafka 포함 인프라 시작
docker compose --profile kafka up -d postgres redis rabbitmq redis-commander zookeeper kafka kafka-ui
```

**예상 출력:**
```
[+] Running 8/8
 ✔ Network ticketing-network        Created
 ✔ Container ticketing-postgres     Started
 ✔ Container ticketing-redis        Started
 ✔ Container ticketing-rabbitmq     Started
 ✔ Container ticketing-redis-commander Started
 ✔ Container ticketing-zookeeper    Started
 ✔ Container ticketing-kafka        Started
 ✔ Container ticketing-kafka-ui     Started
```

> 💡 Kafka는 Zookeeper에 의존하므로 함께 시작됩니다. Kafka UI는 `http://localhost:8082`에서 접속 가능합니다.

---

## 3. 컨테이너 상태 확인

```bash
docker compose ps
```

**예상 출력 (기본):**
```
NAME                        STATUS                   PORTS
ticketing-postgres          Up (healthy)             0.0.0.0:5432->5432/tcp
ticketing-redis             Up (healthy)             0.0.0.0:6379->6379/tcp
ticketing-rabbitmq          Up (healthy)             0.0.0.0:15672->15672/tcp, 0.0.0.0:15673->5672/tcp
ticketing-redis-commander   Up                       0.0.0.0:8081->8081/tcp
```

**예상 출력 (Kafka 포함 시):**
```
NAME                        STATUS                   PORTS
ticketing-postgres          Up (healthy)             0.0.0.0:5432->5432/tcp
ticketing-redis             Up (healthy)             0.0.0.0:6379->6379/tcp
ticketing-rabbitmq          Up (healthy)             0.0.0.0:15672->15672/tcp, 0.0.0.0:15673->5672/tcp
ticketing-redis-commander   Up                       0.0.0.0:8081->8081/tcp
ticketing-zookeeper         Up (healthy)             0.0.0.0:2181->2181/tcp
ticketing-kafka             Up                       0.0.0.0:9092->9092/tcp
ticketing-kafka-ui          Up                       0.0.0.0:8082->8080/tcp
```

> ⚠️ STATUS가 `Up (health: starting)`이면 잠시 대기 후 다시 확인하세요.

---

## 4. 헬스체크 대기

모든 서비스가 healthy 상태가 될 때까지 대기합니다:

```bash
# 헬스체크 상태 확인 (healthy가 될 때까지 반복)
docker compose ps --format "table {{.Name}}\t{{.Status}}"
```

**모든 서비스가 `Up (healthy)`가 되면** 다음 단계로 진행합니다.

---

## 5. 이미지 다운로드 확인

처음 실행 시 이미지를 다운로드합니다:

```bash
docker images | grep -E "postgres|redis|rabbitmq|kafka|zookeeper"
```

**예상 출력 (기본):**
```
postgres                      17-alpine    ...   ~240MB
redis                         7-alpine     ...   ~40MB
rabbitmq                      3.12-management-alpine  ...   ~180MB
rediscommander/redis-commander latest      ...   ~120MB
```

**예상 출력 (Kafka 포함 시):**
```
postgres                      17-alpine    ...   ~240MB
redis                         7-alpine     ...   ~40MB
rabbitmq                      3.12-management-alpine  ...   ~180MB
rediscommander/redis-commander latest      ...   ~120MB
confluentinc/cp-zookeeper     7.5.0        ...   ~800MB
confluentinc/cp-kafka         7.5.0        ...   ~800MB
provectuslabs/kafka-ui        latest       ...   ~400MB
```

---

## ✅ 체크포인트

다음을 확인하세요:

- [ ] `docker compose ps`에서 4개 컨테이너가 보인다 (Kafka 포함 시 7개)
- [ ] postgres, redis, rabbitmq 상태가 `Up (healthy)`이다
- [ ] (Kafka 사용 시) zookeeper, kafka, kafka-ui 컨테이너가 실행 중이다
- [ ] 오류 메시지 없이 정상 시작되었다

---

[← 04. 환경변수 설정](./04-env-setup.md) | [목차](./README.md) | [06. 인프라 확인 →](./06-infra-verify.md)
