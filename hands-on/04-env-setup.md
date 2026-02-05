# 04. 환경변수 설정

[← 03. 프로젝트 클론](./03-project-clone.md) | [목차](./README.md) | [05. 인프라 기동 →](./05-infra-start.md)

---

⏱️ **예상 소요 시간**: 3분

## 목표

`.env` 파일을 생성하고 환경변수를 설정합니다.

---

## 1. 환경변수 파일 생성

템플릿을 복사하여 `.env` 파일을 생성합니다:

```bash
cp .env.example .env
```

---

## 2. 기본 설정 확인

생성된 `.env` 파일을 확인합니다:

```bash
cat .env | head -50
```

핸즈온에서는 **기본값 그대로 사용**해도 됩니다.

---

## 3. 주요 환경변수 설명

### 데이터베이스 (PostgreSQL)
| 변수 | 기본값 | 설명 |
|------|--------|------|
| `POSTGRES_DB` | ticketing | 데이터베이스 이름 |
| `POSTGRES_USER` | admin | DB 사용자 |
| `POSTGRES_PASSWORD` | password | DB 비밀번호 |
| `POSTGRES_PORT` | 5432 | 포트 |

### Redis
| 변수 | 기본값 | 설명 |
|------|--------|------|
| `REDIS_PORT` | 6379 | Redis 포트 |

### RabbitMQ
| 변수 | 기본값 | 설명 |
|------|--------|------|
| `RABBITMQ_USER` | admin | RabbitMQ 사용자 |
| `RABBITMQ_PASSWORD` | password | RabbitMQ 비밀번호 |
| `RABBITMQ_PORT` | 15673 | AMQP 포트 (외부) |
| `RABBITMQ_MGMT_PORT` | 15672 | 관리 UI 포트 |

### Kafka (선택적)
| 변수 | 기본값 | 설명 |
|------|--------|------|
| `KAFKA_BROKER_EXTERNAL` | localhost:9092 | 외부 접속용 브로커 주소 |
| `KAFKA_BROKER_INTERNAL` | kafka:29092 | Docker 내부 브로커 주소 |
| `KAFKA_UI_PORT` | 8082 | Kafka UI 포트 |

> 💡 Kafka는 `--profile kafka` 옵션으로 별도 실행합니다.

### 서비스 포트
| 변수 | 기본값 | 설명 |
|------|--------|------|
| `QUEUE_SERVICE_PORT` | 3001 | Queue Service |
| `TICKET_SERVICE_PORT` | 3002 | Ticket Service |
| `USER_SERVICE_PORT` | 3003 | User Service |
| `FRONTEND_PORT` | 80 | Frontend |

---

## 4. 포트 충돌 확인

기본 포트가 이미 사용 중인지 확인합니다:

```bash
# 주요 포트 사용 여부 확인
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :15672 # RabbitMQ Management
lsof -i :9092  # Kafka (선택적)
lsof -i :8082  # Kafka UI (선택적)
lsof -i :3001  # Queue Service
lsof -i :3002  # Ticket Service
lsof -i :3003  # User Service
lsof -i :80    # Frontend
```

**출력이 없으면** 해당 포트가 사용 가능합니다.

**포트가 사용 중이면** `.env` 파일에서 해당 포트를 변경하세요:

```bash
# 예: PostgreSQL 포트를 5433으로 변경
# .env 파일 편집
POSTGRES_PORT=5433
```

---

## 5. 환경변수 변경 시 주의사항

> ⚠️ **중요**: `.env` 파일을 수정한 후에는 단순히 `docker-compose up -d`만 실행하면 변경이 반영되지 않습니다!

### 백엔드 서비스 환경변수 변경 시

```bash
# 컨테이너 강제 재생성 필요
docker-compose up -d --force-recreate queue-service
```

### 프론트엔드 환경변수 변경 시

프론트엔드는 빌드 시점에 환경변수가 번들에 포함되므로 **이미지 재빌드**가 필요합니다:

```bash
# 이미지 재빌드 필수
docker-compose up -d --build frontend
```

### 전체 재시작 (확실한 방법)

```bash
docker-compose down
docker-compose up -d --build
```

### 변경 확인 방법

```bash
# 컨테이너 내부 환경변수 확인
docker exec ticketing-queue-service printenv | grep QUEUE_MODE

# API로 확인 (Queue Service)
curl -s http://localhost:3001/api/queue/mode | jq
```

---

## 6. 환경변수 로드 확인

```bash
# .env 파일이 정상적으로 읽히는지 확인
source .env && echo "POSTGRES_DB=$POSTGRES_DB"
```

**예상 출력:**
```
POSTGRES_DB=ticketing
```

---

## ✅ 체크포인트

다음을 확인하세요:

- [ ] `.env` 파일이 생성되었다
- [ ] 주요 포트(5432, 6379, 15672, 9092, 8082, 3001-3003, 80)가 사용 가능하다
- [ ] 포트 충돌이 있다면 `.env`에서 변경했다
- [ ] 환경변수 변경 시 `--force-recreate` 또는 `--build` 옵션이 필요함을 이해했다

---

[← 03. 프로젝트 클론](./03-project-clone.md) | [목차](./README.md) | [05. 인프라 기동 →](./05-infra-start.md)
