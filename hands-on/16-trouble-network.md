# 16. 문제 해결: 네트워크/포트 관련

[← 15. Docker 문제](./15-trouble-docker.md) | [목차](./README.md) | [17. 서비스 문제 →](./17-trouble-service.md)

---

## 포트 충돌

### 증상: "port is already allocated"

```
Error response from daemon: driver failed programming external connectivity: 
Bind for 0.0.0.0:5432 failed: port is already allocated
```

### 해결 방법

1. **사용 중인 포트 확인**
   ```bash
   # 특정 포트 사용 프로세스 확인
   lsof -i :5432
   
   # 또는
   netstat -an | grep 5432
   ```

2. **충돌하는 프로세스 종료**
   ```bash
   # PID 확인 후 종료
   kill -9 <PID>
   ```

3. **포트 변경 (.env 파일)**
   ```bash
   # .env 파일에서 포트 변경
   POSTGRES_PORT=5433
   ```

4. **변경 후 재시작**
   ```bash
   docker compose down
   docker compose up -d
   ```

### 자주 충돌하는 포트

| 포트 | 서비스 | 충돌 가능성 |
|------|--------|------------|
| 5432 | PostgreSQL | 로컬 PostgreSQL |
| 6379 | Redis | 로컬 Redis |
| 80 | Frontend | Apache, Nginx |
| 3000-3003 | Backend | 개발 서버 |

---

## 컨테이너 간 통신 실패

### 증상: "Connection refused" 또는 "ECONNREFUSED"

### 해결 방법

1. **네트워크 확인**
   ```bash
   # 네트워크 존재 확인
   docker network ls | grep ticketing
   
   # 네트워크에 연결된 컨테이너 확인
   docker network inspect ticketing-network
   ```

2. **컨테이너가 같은 네트워크에 있는지 확인**
   ```bash
   docker inspect ticketing-queue-service --format '{{.NetworkSettings.Networks}}'
   ```

3. **네트워크 재생성**
   ```bash
   docker compose down
   docker network rm ticketing-network
   docker compose up -d
   ```

---

## DNS 해석 실패

### 증상: "Name does not resolve"

컨테이너 내부에서 다른 서비스 이름으로 접근 실패

### 해결 방법

1. **서비스 이름 확인**
   ```bash
   # docker-compose.yml의 서비스 이름 사용
   # 예: postgres, redis, queue-service
   ```

2. **컨테이너 내부에서 DNS 테스트**
   ```bash
   docker exec -it ticketing-queue-service ping postgres
   ```

3. **Docker DNS 캐시 문제 시**
   ```bash
   docker compose restart
   ```

---

## 외부에서 접근 불가

### 증상: localhost에서 서비스 접근 불가

### 해결 방법

1. **포트 매핑 확인**
   ```bash
   docker compose ps
   # PORTS 열에서 0.0.0.0:3001->3001/tcp 형태 확인
   ```

2. **방화벽 확인 (macOS)**
   - 시스템 환경설정 → 보안 및 개인 정보 보호 → 방화벽
   - Docker가 허용되어 있는지 확인

3. **curl로 직접 테스트**
   ```bash
   curl -v http://localhost:3001/health
   ```

---

## 컨테이너 내부 네트워크 테스트

### 컨테이너 간 연결 테스트

```bash
# queue-service에서 postgres 연결 테스트
docker exec -it ticketing-queue-service sh -c "nc -zv postgres 5432"

# queue-service에서 redis 연결 테스트
docker exec -it ticketing-queue-service sh -c "nc -zv redis 6379"

# queue-service에서 ticket-service 연결 테스트
docker exec -it ticketing-queue-service sh -c "nc -zv ticket-service 3002"
```

### 네트워크 도구 설치 (필요시)

```bash
# Alpine 기반 컨테이너에서
docker exec -it ticketing-queue-service sh -c "apk add --no-cache curl netcat-openbsd"
```

---

## CORS 오류

### 증상: 브라우저에서 "CORS policy" 에러

### 해결 방법

1. **CORS 설정 확인 (.env)**
   ```bash
   # 모든 origin 허용
   CORS_ORIGIN=*
   
   # 또는 특정 origin만 허용
   CORS_ORIGIN=http://localhost,http://localhost:80
   ```

2. **서비스 재시작**
   ```bash
   docker compose restart queue-service
   ```

---

## 네트워크 초기화

모든 네트워크 문제 해결이 안 될 때:

```bash
# 1. 모든 컨테이너 중지 및 삭제
docker compose down

# 2. 네트워크 삭제
docker network rm ticketing-network

# 3. Docker 네트워크 정리
docker network prune -f

# 4. 다시 시작
docker compose up -d
```

---

## 유용한 네트워크 진단 명령어

```bash
# 네트워크 목록
docker network ls

# 네트워크 상세 정보
docker network inspect ticketing-network

# 컨테이너 IP 확인
docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ticketing-queue-service

# 포트 매핑 확인
docker port ticketing-queue-service

# 호스트 포트 사용 확인
lsof -i -P -n | grep LISTEN
```

---

[← 15. Docker 문제](./15-trouble-docker.md) | [목차](./README.md) | [17. 서비스 문제 →](./17-trouble-service.md)
