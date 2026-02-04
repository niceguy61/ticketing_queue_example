# Docker Compose 배포 가이드

이 문서는 Docker Compose를 사용하여 티케팅 대기열 시스템을 로컬 환경에서 실행하는 방법을 설명합니다.

## 목차

1. [사전 요구사항](#사전-요구사항)
2. [빠른 시작](#빠른-시작)
3. [환경 설정](#환경-설정)
4. [서비스 구성](#서비스-구성)
5. [운영 모드](#운영-모드)
6. [메시지 큐 선택](#메시지-큐-선택)
7. [문제 해결](#문제-해결)
8. [유용한 명령어](#유용한-명령어)

## 사전 요구사항

- Docker 20.10 이상
- Docker Compose 2.0 이상
- 최소 4GB RAM
- 최소 10GB 디스크 공간

### 설치 확인

```bash
docker --version
docker-compose --version
```

## 빠른 시작

### 1. 환경 변수 설정

```bash
# .env.example을 .env로 복사
cp .env.example .env

# 필요한 경우 .env 파일 수정
# 기본 설정으로도 실행 가능합니다
```

### 2. 시스템 시작 (Simple 모드, Redis 큐)

```bash
# 모든 서비스 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f
```

### 3. 서비스 접속

- **Frontend**: http://localhost:80
- **Queue Service**: http://localhost:3001
- **Ticket Service**: http://localhost:3002
- **User Service**: http://localhost:3003
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### 4. 시스템 종료

```bash
# 모든 서비스 중지
docker-compose down

# 볼륨까지 삭제 (데이터 초기화)
docker-compose down -v
```

## 환경 설정

### .env 파일 구조

`.env.example` 파일을 참조하여 다음 주요 설정을 구성할 수 있습니다:

#### 필수 설정

```env
# 운영 모드
QUEUE_MODE=simple          # simple 또는 advanced

# 메시지 큐 제공자
QUEUE_PROVIDER=redis       # redis, rabbitmq, sqs, kafka

# 환경
NODE_ENV=development       # development, production, test
```

#### 데이터베이스 설정

```env
POSTGRES_DB=ticketing
POSTGRES_USER=admin
POSTGRES_PASSWORD=password  # 프로덕션에서는 반드시 변경!
POSTGRES_PORT=5432
```

#### 서비스 포트

```env
USER_SERVICE_PORT=3003
TICKET_SERVICE_PORT=3002
QUEUE_SERVICE_PORT=3001
FRONTEND_PORT=80
```

## 서비스 구성

### 핵심 서비스

#### 1. PostgreSQL (데이터베이스)
- **이미지**: postgres:15-alpine
- **포트**: 5432
- **용도**: 사용자 및 티켓 정보 저장
- **볼륨**: postgres-data (영구 저장)

#### 2. Redis (캐시/대기열)
- **이미지**: redis:7-alpine
- **포트**: 6379
- **용도**: 대기열 상태 관리, 캐싱
- **볼륨**: redis-data (영구 저장)

#### 3. User Service
- **포트**: 3003
- **기능**: 사용자 등록, 인증, 조회
- **의존성**: PostgreSQL

#### 4. Ticket Service
- **포트**: 3002
- **기능**: 티켓 발급, 검증, 취소
- **의존성**: PostgreSQL

#### 5. Queue Service
- **포트**: 3001
- **기능**: 대기열 관리, 실시간 업데이트
- **의존성**: Redis, Ticket Service, Message Queue (선택적)

#### 6. Frontend
- **포트**: 80
- **기능**: 웹 인터페이스
- **의존성**: 모든 백엔드 서비스

### 선택적 서비스 (Profiles)

#### RabbitMQ (메시지 큐)

```bash
# RabbitMQ와 함께 시작
docker-compose --profile rabbitmq up -d

# .env 설정
QUEUE_PROVIDER=rabbitmq
RABBITMQ_URL=amqp://admin:password@rabbitmq:5672
```

- **포트**: 5672 (AMQP), 15672 (Management UI)
- **Management UI**: http://localhost:15672
- **기본 계정**: admin / password

#### LocalStack (AWS 에뮬레이터)

```bash
# LocalStack과 함께 시작
docker-compose --profile localstack up -d

# .env 설정
QUEUE_PROVIDER=sqs
AWS_ENDPOINT=http://localstack:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

- **포트**: 4566
- **지원 서비스**: SQS, SNS
- **용도**: 로컬에서 AWS 서비스 테스트

## 운영 모드

### Simple 모드 (단일 대기열)

초급 학습용 - 단일 로비 대기열만 운영

```env
QUEUE_MODE=simple
```

**특징**:
- 단일 로비 대기열
- 직접 티켓 발급
- 간단한 플로우

**사용 시나리오**:
1. 사용자 등록
2. 로비 대기열 진입
3. 차례 대기
4. 티켓 발급

### Advanced 모드 (이단 대기열)

고급 학습용 - 로비 + 티케팅별 대기열

```env
QUEUE_MODE=advanced
```

**특징**:
- 로비 대기열 + 티케팅별 대기열
- 이벤트 선택 단계
- 복잡한 플로우

**사용 시나리오**:
1. 사용자 등록
2. 로비 대기열 진입
3. 차례 대기
4. 티케팅 이벤트 선택
5. 티켓 대기열 진입
6. 티켓 발급

## 메시지 큐 선택

### 1. Redis (기본, 권장)

**장점**:
- 설정 간단
- 빠른 성능
- 추가 서비스 불필요

**단점**:
- 기본 기능만 제공
- 메시지 영속성 제한적

**설정**:
```env
QUEUE_PROVIDER=redis
```

**시작**:
```bash
docker-compose up -d
```

### 2. RabbitMQ

**장점**:
- 풍부한 기능
- 메시지 라우팅
- 관리 UI 제공

**단점**:
- 추가 메모리 사용
- 설정 복잡도 증가

**설정**:
```env
QUEUE_PROVIDER=rabbitmq
RABBITMQ_URL=amqp://admin:password@rabbitmq:5672
```

**시작**:
```bash
docker-compose --profile rabbitmq up -d
```

### 3. LocalStack SQS

**장점**:
- AWS SQS 경험
- 실제 AWS와 유사
- 로컬 테스트 가능

**단점**:
- 추가 리소스 필요
- 완벽한 AWS 호환은 아님

**설정**:
```env
QUEUE_PROVIDER=sqs
AWS_ENDPOINT=http://localstack:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_REGION=us-east-1
```

**시작**:
```bash
docker-compose --profile localstack up -d

# SQS 큐 생성 (초기 1회)
docker-compose exec localstack awslocal sqs create-queue --queue-name ticket-issue-queue
```

### 4. Kafka (고급)

**장점**:
- 높은 처리량
- 이벤트 스트리밍
- 로그 보관

**단점**:
- 복잡한 설정
- 높은 리소스 사용

**참고**: Kafka는 별도 docker-compose 파일 필요

## 문제 해결

### 서비스가 시작되지 않음

```bash
# 로그 확인
docker-compose logs [service-name]

# 예: Queue Service 로그
docker-compose logs queue-service

# 모든 서비스 상태 확인
docker-compose ps
```

### 데이터베이스 연결 실패

```bash
# PostgreSQL 헬스 체크
docker-compose exec postgres pg_isready -U admin -d ticketing

# PostgreSQL 로그 확인
docker-compose logs postgres

# 데이터베이스 재시작
docker-compose restart postgres
```

### Redis 연결 실패

```bash
# Redis 연결 테스트
docker-compose exec redis redis-cli ping

# Redis 로그 확인
docker-compose logs redis

# Redis 재시작
docker-compose restart redis
```

### 포트 충돌

다른 애플리케이션이 포트를 사용 중인 경우:

```env
# .env 파일에서 포트 변경
POSTGRES_PORT=5433
REDIS_PORT=6380
USER_SERVICE_PORT=3013
TICKET_SERVICE_PORT=3012
QUEUE_SERVICE_PORT=3011
FRONTEND_PORT=8080
```

### 볼륨 권한 문제

```bash
# 볼륨 삭제 후 재생성
docker-compose down -v
docker-compose up -d
```

### 메모리 부족

```bash
# 사용하지 않는 컨테이너/이미지 정리
docker system prune -a

# 볼륨 정리
docker volume prune
```

## 유용한 명령어

### 기본 명령어

```bash
# 백그라운드에서 시작
docker-compose up -d

# 포그라운드에서 시작 (로그 실시간 확인)
docker-compose up

# 특정 서비스만 시작
docker-compose up -d queue-service

# 서비스 중지
docker-compose stop

# 서비스 중지 및 컨테이너 삭제
docker-compose down

# 볼륨까지 삭제 (데이터 초기화)
docker-compose down -v
```

### 로그 확인

```bash
# 모든 서비스 로그
docker-compose logs

# 특정 서비스 로그
docker-compose logs queue-service

# 실시간 로그 (tail -f)
docker-compose logs -f

# 최근 100줄만 보기
docker-compose logs --tail=100
```

### 서비스 관리

```bash
# 서비스 재시작
docker-compose restart queue-service

# 서비스 상태 확인
docker-compose ps

# 실행 중인 프로세스 확인
docker-compose top

# 리소스 사용량 확인
docker stats
```

### 컨테이너 접속

```bash
# 컨테이너 쉘 접속
docker-compose exec queue-service sh

# PostgreSQL 접속
docker-compose exec postgres psql -U admin -d ticketing

# Redis CLI 접속
docker-compose exec redis redis-cli
```

### 이미지 관리

```bash
# 이미지 빌드
docker-compose build

# 캐시 없이 빌드
docker-compose build --no-cache

# 특정 서비스만 빌드
docker-compose build queue-service

# 빌드 후 시작
docker-compose up -d --build
```

### 데이터베이스 관리

```bash
# 데이터베이스 백업
docker-compose exec postgres pg_dump -U admin ticketing > backup.sql

# 데이터베이스 복원
docker-compose exec -T postgres psql -U admin ticketing < backup.sql

# 스키마 재적용
docker-compose exec -T postgres psql -U admin ticketing < database/schema.sql
```

### 네트워크 관리

```bash
# 네트워크 확인
docker network ls

# 네트워크 상세 정보
docker network inspect ticketing-network

# 네트워크 재생성
docker-compose down
docker network rm ticketing-network
docker-compose up -d
```

## 개발 워크플로우

### 코드 변경 후 재배포

```bash
# 1. 서비스 중지
docker-compose stop queue-service

# 2. 이미지 재빌드
docker-compose build queue-service

# 3. 서비스 재시작
docker-compose up -d queue-service

# 또는 한 번에
docker-compose up -d --build queue-service
```

### 데이터 초기화

```bash
# 모든 데이터 삭제
docker-compose down -v

# 스키마 재적용하여 시작
docker-compose up -d
```

### 로그 레벨 변경

```env
# .env 파일 수정
LOG_LEVEL=debug

# 서비스 재시작
docker-compose restart
```

## 프로덕션 배포 고려사항

### 보안

1. **비밀번호 변경**
   ```env
   POSTGRES_PASSWORD=<strong-random-password>
   RABBITMQ_PASSWORD=<strong-random-password>
   ```

2. **환경 변수 관리**
   - `.env` 파일을 Git에 커밋하지 않기
   - 프로덕션 환경에서는 시크릿 관리 도구 사용

3. **네트워크 격리**
   - 외부 노출이 필요한 포트만 열기
   - 내부 서비스는 Docker 네트워크로만 통신

### 성능

1. **리소스 제한**
   ```yaml
   services:
     queue-service:
       deploy:
         resources:
           limits:
             cpus: '1'
             memory: 512M
   ```

2. **헬스 체크 조정**
   - 프로덕션 환경에 맞게 interval, timeout 조정

3. **로그 관리**
   - 로그 드라이버 설정
   - 로그 로테이션 구성

### 모니터링

1. **헬스 체크 엔드포인트**
   - 각 서비스: `/health`
   - 모니터링 도구와 연동

2. **메트릭 수집**
   - Prometheus, Grafana 등 연동 고려

## 참고 자료

- [Docker Compose 공식 문서](https://docs.docker.com/compose/)
- [PostgreSQL Docker 이미지](https://hub.docker.com/_/postgres)
- [Redis Docker 이미지](https://hub.docker.com/_/redis)
- [RabbitMQ Docker 이미지](https://hub.docker.com/_/rabbitmq)
- [LocalStack 문서](https://docs.localstack.cloud/)

## 다음 단계

- [AWS 배포 가이드](./aws-guide.md)
- [Docker 빌드 가이드](./docker-build-guide.md)
- [개발 가이드](../development.md)
