# 20. 리소스 정리

[← 19. 서비스 문제](./19-trouble-service.md) | [목차](./README.md)

---

⏱️ **예상 소요 시간**: 2분

## 목표

핸즈온에서 사용한 Docker 리소스를 정리합니다.

---

## 1. 서비스 중지

### 모든 컨테이너 중지

```bash
docker compose down
```

**예상 출력:**
```
[+] Running 8/8
 ✔ Container ticketing-frontend         Removed
 ✔ Container ticketing-queue-service    Removed
 ✔ Container ticketing-ticket-service   Removed
 ✔ Container ticketing-user-service     Removed
 ✔ Container ticketing-redis-commander  Removed
 ✔ Container ticketing-rabbitmq         Removed
 ✔ Container ticketing-redis            Removed
 ✔ Container ticketing-postgres         Removed
 ✔ Network ticketing-network            Removed
```

---

## 2. 데이터 볼륨 삭제

### 볼륨 포함 삭제 (데이터 초기화)

```bash
docker compose down -v
```

> ⚠️ PostgreSQL, Redis, RabbitMQ의 모든 데이터가 삭제됩니다.

---

## 3. 이미지 삭제 (선택)

### 빌드된 이미지만 삭제

```bash
docker rmi $(docker images -q "ticketing-queue-system*")
```

### 모든 관련 이미지 삭제

```bash
# 프로젝트 이미지
docker rmi ticketing-queue-system-queue-service
docker rmi ticketing-queue-system-ticket-service
docker rmi ticketing-queue-system-user-service
docker rmi ticketing-queue-system-frontend

# 베이스 이미지 (다른 프로젝트에서 사용할 수 있으므로 선택적)
docker rmi postgres:17-alpine
docker rmi redis:7-alpine
docker rmi rabbitmq:3.12-management-alpine
docker rmi rediscommander/redis-commander:latest
```

---

## 4. 전체 정리 (완전 초기화)

### Docker 시스템 정리

```bash
# 사용하지 않는 모든 리소스 삭제
docker system prune -a --volumes
```

> ⚠️ 이 명령은 **모든** 미사용 Docker 리소스를 삭제합니다.
> 다른 프로젝트의 리소스도 삭제될 수 있으니 주의하세요.

---

## 5. 정리 확인

```bash
# 실행 중인 컨테이너 없음 확인
docker ps

# 프로젝트 관련 이미지 없음 확인
docker images | grep ticketing

# 볼륨 없음 확인
docker volume ls | grep ticketing
```

---

## 다시 시작하려면

핸즈온을 처음부터 다시 진행하려면:

```bash
# 프로젝트 디렉토리로 이동
cd ticketing-queue-system

# 05단계부터 다시 시작
docker compose up -d postgres redis rabbitmq redis-commander
```

---

## 🎉 핸즈온 완료

축하합니다! 티켓팅 큐 시스템 핸즈온을 완료했습니다.

### 학습한 내용

- Docker Desktop 설치 및 기본 사용법
- docker-compose를 이용한 멀티 컨테이너 환경 구성
- PostgreSQL, Redis, RabbitMQ, Kafka 인프라 구성
- 마이크로서비스 아키텍처 이해
- Redis Commander, RabbitMQ Management UI, Kafka UI 모니터링
- Docker 로그 확인 및 문제 해결

### 다음 단계

- [가이드 문서](../guide/README.md)에서 큐 아키텍처 심화 학습
- [API 문서](../docs/api/)에서 각 서비스 API 상세 확인
- [아키텍처 문서](../docs/architecture.md)에서 시스템 설계 이해

---

[← 17. 서비스 문제](./17-trouble-service.md) | [목차](./README.md)
