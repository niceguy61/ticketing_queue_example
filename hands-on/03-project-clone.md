# 03. 프로젝트 클론

[← 02. Docker 확인](./02-docker-verify.md) | [목차](./README.md) | [04. 환경변수 설정 →](./04-env-setup.md)

---

⏱️ **예상 소요 시간**: 2분

## 목표

GitHub에서 프로젝트를 클론하고 디렉토리 구조를 확인합니다.

---

## 1. 프로젝트 클론

원하는 디렉토리로 이동 후 클론합니다:

```bash
# 작업 디렉토리로 이동 (예시)
cd ~/projects

# 프로젝트 클론
git clone https://github.com/niceguy61/ticketing_queue_example.git ticketing-queue-system

# 프로젝트 디렉토리로 이동
cd ticketing-queue-system
```

> 💡 `<repository-url>`은 실제 저장소 URL로 대체하세요.

---

## 2. 디렉토리 구조 확인

```bash
ls -la
```

**주요 디렉토리:**
```
ticketing-queue-system/
├── backend/
│   ├── database/          # DB 스키마 및 연결 설정
│   └── services/
│       ├── queue-service/   # 대기열 관리 서비스
│       ├── ticket-service/  # 티켓 발급 서비스
│       └── user-service/    # 사용자 관리 서비스
├── frontend/              # React 프론트엔드
├── scripts/               # 유틸리티 스크립트
├── docker-compose.yml     # Docker Compose 설정
├── .env.example           # 환경변수 템플릿
└── README.md
```

---

## 3. 필수 파일 존재 확인

```bash
# docker-compose.yml 존재 확인
ls docker-compose.yml

# 환경변수 템플릿 확인
ls .env.example

# 백엔드 서비스 Dockerfile 확인
ls backend/services/*/Dockerfile
```

**예상 출력:**
```
backend/services/queue-service/Dockerfile
backend/services/ticket-service/Dockerfile
backend/services/user-service/Dockerfile
```

---

## ✅ 체크포인트

다음을 확인하세요:

- [ ] 프로젝트 디렉토리로 이동했다 (`pwd`로 확인)
- [ ] `docker-compose.yml` 파일이 존재한다
- [ ] `.env.example` 파일이 존재한다
- [ ] 각 서비스의 `Dockerfile`이 존재한다

---

[← 02. Docker 확인](./02-docker-verify.md) | [목차](./README.md) | [04. 환경변수 설정 →](./04-env-setup.md)
