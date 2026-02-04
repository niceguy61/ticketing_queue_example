# Frontend - 티케팅 대기열 시스템

React + TypeScript 기반 프론트엔드 애플리케이션입니다.

## 기술 스택

- **React 18**: UI 라이브러리
- **TypeScript**: 타입 안전성
- **Vite**: 빌드 도구
- **React Router**: 라우팅
- **Socket.io Client**: 실시간 통신
- **Axios**: HTTP 클라이언트

## 프로젝트 구조

```
frontend/
├── src/
│   ├── api/                    # API 클라이언트 모듈
│   │   ├── client.ts          # Axios 인스턴스 및 인터셉터
│   │   ├── userService.ts     # User Service API
│   │   ├── queueService.ts    # Queue Service API
│   │   ├── ticketService.ts   # Ticket Service API
│   │   └── index.ts
│   ├── components/            # 공통 UI 컴포넌트
│   │   ├── QueueStatus.tsx    # 대기열 상태 표시
│   │   ├── LoadingSpinner.tsx # 로딩 스피너
│   │   ├── ErrorMessage.tsx   # 에러 메시지
│   │   ├── SuccessMessage.tsx # 성공 메시지
│   │   └── index.ts
│   ├── hooks/                 # 커스텀 훅
│   │   └── useQueue.ts        # Socket.io 연결 및 대기열 관리
│   ├── pages/                 # 페이지 컴포넌트
│   │   ├── UserRegistration.tsx
│   │   ├── LobbyQueue.tsx
│   │   ├── EventSelection.tsx
│   │   ├── TicketQueue.tsx
│   │   └── TicketDisplay.tsx
│   ├── types/                 # TypeScript 타입 정의
│   │   └── index.ts
│   ├── config/                # 설정
│   │   └── index.ts
│   ├── App.tsx                # 메인 앱 컴포넌트
│   ├── main.tsx               # 엔트리 포인트
│   ├── index.css              # 글로벌 스타일
│   └── vite-env.d.ts          # Vite 환경 변수 타입
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .env.example
```

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example`을 복사하여 `.env` 파일을 생성하고 필요한 값을 설정합니다:

```bash
cp .env.example .env
```

```env
VITE_QUEUE_SERVICE_URL=http://localhost:3001
VITE_TICKET_SERVICE_URL=http://localhost:3002
VITE_USER_SERVICE_URL=http://localhost:3003
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 으로 접속합니다.

### 4. 프로덕션 빌드

```bash
npm run build
```

빌드된 파일은 `dist/` 디렉토리에 생성됩니다.

### 5. 프로덕션 미리보기

```bash
npm run preview
```

## 주요 기능

### API 클라이언트 (src/api/)

- **자동 인증**: localStorage의 세션 토큰을 자동으로 요청 헤더에 추가
- **에러 처리**: 응답 인터셉터를 통한 통합 에러 처리
- **서비스별 분리**: User, Queue, Ticket 서비스별 API 함수 제공

### Socket.io 연결 (src/hooks/useQueue.ts)

- **자동 재연결**: 연결 끊김 시 자동 재연결 시도
- **실시간 업데이트**: 대기열 위치, 상태, 티켓 발급 알림
- **이벤트 관리**: Socket.io 이벤트 리스너 자동 설정 및 정리

### 공통 컴포넌트 (src/components/)

- **QueueStatus**: 대기 위치, 전체 인원, 예상 시간 표시
- **LoadingSpinner**: 로딩 상태 표시 (small/medium/large)
- **ErrorMessage**: 에러 메시지 및 재시도 버튼
- **SuccessMessage**: 성공 메시지 표시

## 라우팅

| 경로 | 컴포넌트 | 설명 |
|------|---------|------|
| `/` | Redirect | `/register`로 리다이렉트 |
| `/register` | UserRegistration | 사용자 등록 |
| `/lobby` | LobbyQueue | 로비 대기열 (Simple 모드) |
| `/events` | EventSelection | 이벤트 선택 (Advanced 모드) |
| `/ticket-queue/:eventId` | TicketQueue | 티켓 대기열 (Advanced 모드) |
| `/ticket/:ticketId` | TicketDisplay | 티켓 정보 표시 |

## 개발 가이드

### 새로운 페이지 추가

1. `src/pages/` 에 컴포넌트 생성
2. `src/App.tsx` 에 라우트 추가

### 새로운 API 추가

1. 해당 서비스 파일에 함수 추가 (예: `src/api/userService.ts`)
2. 타입 정의가 필요하면 `src/types/index.ts` 업데이트

### 새로운 컴포넌트 추가

1. `src/components/` 에 컴포넌트 및 CSS 파일 생성
2. `src/components/index.ts` 에 export 추가

## 다음 단계

- Task 13: Simple 모드 화면 구현
- Task 14: Advanced 모드 화면 구현
- Task 15: E2E 테스트

## 참고사항

- 모든 페이지 컴포넌트는 현재 placeholder 상태입니다
- Task 13과 14에서 실제 기능이 구현됩니다
- Socket.io 연결은 `useQueue` 훅을 통해 관리됩니다
