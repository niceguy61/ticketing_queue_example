# 07. 백엔드 이미지 빌드

[← 06. 인프라 확인](./06-infra-verify.md) | [목차](./README.md) | [08. 백엔드 기동 →](./08-backend-start.md)

---

⏱️ **예상 소요 시간**: 5분 (첫 빌드 시)

## 목표

User Service, Ticket Service, Queue Service의 Docker 이미지를 빌드합니다.

---

## 1. 백엔드 서비스 빌드

프로젝트 루트 디렉토리에서 실행합니다:

```bash
# 모든 백엔드 서비스 이미지 빌드
docker compose build user-service ticket-service queue-service
```

**예상 출력:**
```
[+] Building 120.5s (35/35) FINISHED
 => [user-service] ...
 => [ticket-service] ...
 => [queue-service] ...
```

> ⚠️ 첫 빌드는 npm 패키지 다운로드로 인해 3-5분 소요될 수 있습니다.

---

## 2. 개별 서비스 빌드 (선택)

특정 서비스만 빌드하려면:

```bash
# User Service만 빌드
docker compose build user-service

# Ticket Service만 빌드
docker compose build ticket-service

# Queue Service만 빌드
docker compose build queue-service
```

---

## 3. 빌드된 이미지 확인

```bash
docker images | grep -E "user-service|ticket-service|queue-service"
```

**예상 출력:**
```
ticketing-queue-system-queue-service    latest    ...    ~300MB
ticketing-queue-system-ticket-service   latest    ...    ~250MB
ticketing-queue-system-user-service     latest    ...    ~250MB
```

---

## 4. 빌드 캐시 정보

### 재빌드 시

코드 변경 후 재빌드하면 캐시를 활용하여 빠르게 빌드됩니다:

```bash
# 변경된 부분만 재빌드
docker compose build user-service
```

### 캐시 없이 빌드 (문제 발생 시)

```bash
# 캐시 무시하고 처음부터 빌드
docker compose build --no-cache user-service ticket-service queue-service
```

---

## 5. 빌드 오류 해결

### 메모리 부족 오류

Docker Desktop → Settings → Resources에서 메모리를 4GB 이상으로 설정

### npm 패키지 다운로드 실패

```bash
# 네트워크 문제 시 재시도
docker compose build --no-cache user-service
```

### Dockerfile 문법 오류

```bash
# 특정 서비스의 상세 빌드 로그 확인
docker compose build --progress=plain user-service
```

---

## ✅ 체크포인트

다음을 확인하세요:

- [ ] 빌드가 오류 없이 완료되었다
- [ ] `docker images`에서 3개 서비스 이미지가 보인다
- [ ] 각 이미지 크기가 200-400MB 범위이다

---

[← 06. 인프라 확인](./06-infra-verify.md) | [목차](./README.md) | [08. 백엔드 기동 →](./08-backend-start.md)
