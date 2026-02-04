# Docker Build Guide

이 가이드는 티케팅 대기열 시스템의 Docker 이미지를 빌드하는 방법을 설명합니다.

## 목차

1. [사전 요구사항](#사전-요구사항)
2. [빌드 스크립트 사용](#빌드-스크립트-사용)
3. [개별 서비스 빌드](#개별-서비스-빌드)
4. [이미지 확인](#이미지-확인)
5. [문제 해결](#문제-해결)

## 사전 요구사항

### Docker 설치

Docker가 설치되어 있고 실행 중이어야 합니다.

**확인 방법:**
```bash
docker --version
docker info
```

**설치 방법:**
- Windows/Mac: [Docker Desktop](https://www.docker.com/products/docker-desktop)
- Linux: [Docker Engine](https://docs.docker.com/engine/install/)

### 시스템 요구사항

- **디스크 공간**: 최소 5GB 여유 공간
- **메모리**: 최소 4GB RAM 권장
- **CPU**: 멀티코어 프로세서 권장

## 빌드 스크립트 사용

### 모든 서비스 빌드

프로젝트 루트 디렉토리에서 실행:

**Linux/Mac:**
```bash
# 실행 권한 부여 (최초 1회)
chmod +x scripts/build-images.sh

# 기본 빌드 (latest 태그)
./scripts/build-images.sh

# 버전 태그 지정
./scripts/build-images.sh -v 1.0.0

# 레지스트리 접두사 포함
./scripts/build-images.sh -r myregistry.com -v 1.0.0
```

**Windows (PowerShell):**
```powershell
# 기본 빌드 (latest 태그)
.\scripts\build-images.ps1

# 버전 태그 지정
.\scripts\build-images.ps1 -Version 1.0.0

# 레지스트리 접두사 포함
.\scripts\build-images.ps1 -Registry myregistry.com -Version 1.0.0
```

### 환경 변수 사용

```bash
# Linux/Mac
VERSION=1.0.0 ./scripts/build-images.sh

# Windows (PowerShell)
$env:VERSION="1.0.0"
.\scripts\build-images.ps1
```

## 개별 서비스 빌드

특정 서비스만 빌드하려면:

### Queue Service

```bash
docker build -t queue-service:latest services/queue-service/
```

### Ticket Service

```bash
docker build -t ticket-service:latest services/ticket-service/
```

### User Service

```bash
docker build -t user-service:latest services/user-service/
```

### Frontend

```bash
docker build -t frontend:latest frontend/
```

## 이미지 확인

### 빌드된 이미지 목록 확인

```bash
docker images | grep -E "queue-service|ticket-service|user-service|frontend"
```

**예상 출력:**
```
queue-service    latest    abc123def456    2 minutes ago    150MB
queue-service    1.0.0     abc123def456    2 minutes ago    150MB
ticket-service   latest    def456ghi789    3 minutes ago    145MB
user-service     latest    ghi789jkl012    4 minutes ago    145MB
frontend         latest    jkl012mno345    5 minutes ago    25MB
```

### 이미지 상세 정보 확인

```bash
docker inspect queue-service:latest
```

### 이미지 크기 확인

```bash
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
```

## 빌드 최적화

### 멀티스테이지 빌드

모든 Dockerfile은 멀티스테이지 빌드를 사용하여 최적화되어 있습니다:

1. **빌드 스테이지**: TypeScript 컴파일 및 의존성 설치
2. **프로덕션 스테이지**: 프로덕션 의존성만 포함, 최소 이미지 크기

### 빌드 캐시 활용

Docker는 레이어 캐싱을 사용하여 빌드 속도를 향상시킵니다:

```bash
# 캐시 없이 빌드 (클린 빌드)
docker build --no-cache -t queue-service:latest services/queue-service/

# 특정 레이어부터 재빌드
docker build --pull -t queue-service:latest services/queue-service/
```

### BuildKit 사용 (권장)

BuildKit은 더 빠른 빌드와 더 나은 캐싱을 제공합니다:

```bash
# Linux/Mac
DOCKER_BUILDKIT=1 docker build -t queue-service:latest services/queue-service/

# Windows (PowerShell)
$env:DOCKER_BUILDKIT=1
docker build -t queue-service:latest services/queue-service/
```

## 로컬 테스트

### 개별 컨테이너 실행

```bash
# Queue Service
docker run -d \
  --name queue-service \
  -p 3001:3001 \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  queue-service:latest

# Ticket Service
docker run -d \
  --name ticket-service \
  -p 3002:3002 \
  -e DATABASE_URL=postgresql://user:pass@host.docker.internal:5432/ticketing \
  ticket-service:latest

# User Service
docker run -d \
  --name user-service \
  -p 3003:3003 \
  -e DATABASE_URL=postgresql://user:pass@host.docker.internal:5432/ticketing \
  user-service:latest

# Frontend
docker run -d \
  --name frontend \
  -p 3000:80 \
  frontend:latest
```

### 헬스 체크 확인

```bash
# Queue Service
curl http://localhost:3001/health

# Ticket Service
curl http://localhost:3002/health

# User Service
curl http://localhost:3003/health

# Frontend
curl http://localhost:3000/health
```

### 컨테이너 로그 확인

```bash
docker logs queue-service
docker logs ticket-service
docker logs user-service
docker logs frontend
```

### 컨테이너 중지 및 제거

```bash
docker stop queue-service ticket-service user-service frontend
docker rm queue-service ticket-service user-service frontend
```

## 문제 해결

### 빌드 실패

**문제**: `npm ci` 실패
```
npm ERR! code ENOENT
npm ERR! syscall open
npm ERR! path /app/package-lock.json
```

**해결책**: package-lock.json 파일이 존재하는지 확인
```bash
cd services/queue-service
npm install  # package-lock.json 생성
```

---

**문제**: TypeScript 컴파일 에러
```
error TS2307: Cannot find module 'express'
```

**해결책**: 의존성 재설치
```bash
cd services/queue-service
rm -rf node_modules package-lock.json
npm install
```

---

**문제**: Docker 빌드 시 메모리 부족
```
ERROR: failed to solve: process "/bin/sh -c npm ci" did not complete successfully
```

**해결책**: Docker Desktop 메모리 할당 증가
- Docker Desktop 설정 → Resources → Memory를 4GB 이상으로 설정

### 이미지 크기 문제

**문제**: 이미지가 너무 큼 (>500MB)

**해결책**:
1. .dockerignore 파일 확인
2. node_modules가 제외되었는지 확인
3. 멀티스테이지 빌드 사용 확인

### 권한 문제

**문제**: Linux에서 스크립트 실행 권한 없음
```
bash: ./scripts/build-images.sh: Permission denied
```

**해결책**:
```bash
chmod +x scripts/build-images.sh
```

### 네트워크 문제

**문제**: npm install 시 네트워크 타임아웃

**해결책**:
```bash
# npm 레지스트리 변경
docker build --build-arg NPM_REGISTRY=https://registry.npmmirror.com -t queue-service:latest services/queue-service/
```

## 다음 단계

이미지 빌드가 완료되면:

1. **로컬 테스트**: [Docker Compose 가이드](./docker-compose.md) 참조
2. **AWS 배포**: [AWS 배포 가이드](./aws-guide.md) 참조
3. **ECR 푸시**: ECR 푸시 스크립트 사용

## 참고 자료

- [Docker 공식 문서](https://docs.docker.com/)
- [Docker 멀티스테이지 빌드](https://docs.docker.com/build/building/multi-stage/)
- [Docker BuildKit](https://docs.docker.com/build/buildkit/)
- [Dockerfile 베스트 프랙티스](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
