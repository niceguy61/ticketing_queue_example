# 14. 문제 해결: Docker 관련

[← 13. 로그 확인](./13-monitor-logs.md) | [목차](./README.md) | [15. 네트워크 문제 →](./15-trouble-network.md)

---

## Docker 데몬 문제

### 증상: "Cannot connect to the Docker daemon"

```
Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?
```

### 해결 방법

1. **Docker Desktop 실행 확인**
   ```bash
   # 상단 메뉴바에 🐳 아이콘이 있는지 확인
   # 없으면 Docker Desktop 앱 실행
   open -a Docker
   ```

2. **Docker Desktop 재시작**
   - 메뉴바 🐳 아이콘 클릭 → Restart

3. **Docker Desktop 완전 종료 후 재시작**
   ```bash
   # Docker Desktop 종료
   osascript -e 'quit app "Docker"'
   
   # 잠시 대기 후 재시작
   sleep 5
   open -a Docker
   ```

---

## 리소스 부족 문제

### 증상: 빌드 또는 실행 중 멈춤

컨테이너가 시작되지 않거나 빌드가 멈추는 경우

### 해결 방법

1. **Docker Desktop 리소스 설정 확인**
   - Docker Desktop → Settings → Resources
   - Memory: 최소 4GB 이상
   - CPUs: 최소 2개 이상

2. **사용하지 않는 리소스 정리**
   ```bash
   # 중지된 컨테이너 삭제
   docker container prune -f
   
   # 사용하지 않는 이미지 삭제
   docker image prune -f
   
   # 사용하지 않는 볼륨 삭제
   docker volume prune -f
   
   # 전체 정리 (주의: 모든 미사용 리소스 삭제)
   docker system prune -f
   ```

3. **디스크 공간 확인**
   ```bash
   # Docker 디스크 사용량 확인
   docker system df
   ```

---

## 이미지 빌드 실패

### 증상: "failed to solve" 또는 빌드 에러

### 해결 방법

1. **캐시 없이 재빌드**
   ```bash
   docker compose build --no-cache queue-service
   ```

2. **BuildKit 캐시 정리**
   ```bash
   docker builder prune -f
   ```

3. **특정 단계에서 실패 시 상세 로그 확인**
   ```bash
   docker compose build --progress=plain queue-service
   ```

---

## 컨테이너 시작 실패

### 증상: "Container exited with code 1"

### 해결 방법

1. **컨테이너 로그 확인**
   ```bash
   docker compose logs queue-service
   ```

2. **컨테이너 상세 정보 확인**
   ```bash
   docker inspect ticketing-queue-service
   ```

3. **컨테이너 삭제 후 재생성**
   ```bash
   docker compose down
   docker compose up -d
   ```

---

## 환경변수 변경이 반영 안 될 때

### 증상: `.env` 파일 수정 후 `docker-compose up -d` 했는데 이전 값 그대로

예: `QUEUE_MODE=advanced`로 변경했는데 계속 `simple`로 동작

### 원인

Docker Compose는 기존 컨테이너가 있으면 재사용합니다. `.env` 변경만으로는 컨테이너가 재생성되지 않습니다.

### 해결 방법

1. **백엔드 서비스: 컨테이너 강제 재생성**
   ```bash
   # 특정 서비스만 재생성
   docker-compose up -d --force-recreate queue-service
   
   # 또는 전체 재생성
   docker-compose up -d --force-recreate
   ```

2. **프론트엔드: 이미지 재빌드 필수**
   
   프론트엔드(Vite)는 빌드 시점에 환경변수가 번들에 포함됩니다:
   ```bash
   # 이미지 재빌드
   docker-compose up -d --build frontend
   ```

3. **확실한 방법: 전체 재시작**
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

### 변경 확인 방법

```bash
# 컨테이너 내부 환경변수 확인
docker exec ticketing-queue-service printenv | grep QUEUE_MODE

# API로 확인
curl -s http://localhost:3001/api/queue/mode | jq
```

**예상 출력:**
```json
{
  "success": true,
  "data": {
    "mode": "advanced"
  }
}
```

---

## Docker Compose 버전 문제

### 증상: "version is obsolete" 경고

### 해결 방법

이 경고는 무시해도 됩니다. 최신 Docker Compose는 `version` 필드가 필요 없습니다.

경고를 없애려면 `docker-compose.yml`에서 `version` 줄을 삭제하세요.

---

## 이미지 Pull 실패

### 증상: "pull access denied" 또는 "manifest unknown"

### 해결 방법

1. **이미지 이름 확인**
   ```bash
   # 올바른 이미지 이름인지 확인
   docker pull postgres:17-alpine
   ```

2. **네트워크 연결 확인**
   ```bash
   # Docker Hub 연결 테스트
   curl -s https://hub.docker.com/v2/ | head -1
   ```

3. **Docker Hub 로그인 (private 이미지인 경우)**
   ```bash
   docker login
   ```

---

## Docker Desktop 업데이트 후 문제

### 증상: 업데이트 후 기존 컨테이너/이미지 문제

### 해결 방법

1. **Docker Desktop 재시작**

2. **문제 지속 시 초기화**
   - Docker Desktop → Troubleshoot → Reset to factory defaults
   
   > ⚠️ 모든 컨테이너, 이미지, 볼륨이 삭제됩니다.

---

## 유용한 진단 명령어

```bash
# Docker 버전 확인
docker version

# Docker 시스템 정보
docker info

# 실행 중인 컨테이너
docker ps

# 모든 컨테이너 (중지 포함)
docker ps -a

# 이미지 목록
docker images

# 디스크 사용량
docker system df

# 실시간 리소스 사용량
docker stats
```

---

[← 13. 로그 확인](./13-monitor-logs.md) | [목차](./README.md) | [15. 네트워크 문제 →](./15-trouble-network.md)
