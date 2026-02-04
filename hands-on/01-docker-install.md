# 01. Docker Desktop 설치

[← 목차](./README.md) | [02. Docker 확인 →](./02-docker-verify.md)

---

⏱️ **예상 소요 시간**: 5분

## 목표

macOS에 Docker Desktop을 설치합니다.

---

## 1. Docker Desktop 다운로드

### 방법 A: 공식 웹사이트

1. [Docker Desktop 다운로드 페이지](https://www.docker.com/products/docker-desktop/) 접속
2. **Download for Mac** 클릭
3. 칩셋에 맞는 버전 선택:
   - **Apple Silicon** (M1/M2/M3)
   - **Intel chip**

### 방법 B: Homebrew 사용 (권장)

```bash
# Homebrew가 설치되어 있다면
brew install --cask docker
```

---

## 2. Docker Desktop 설치

### DMG 파일로 설치한 경우

1. 다운로드된 `Docker.dmg` 파일 더블클릭
2. Docker 아이콘을 Applications 폴더로 드래그
3. Applications에서 Docker 실행

### Homebrew로 설치한 경우

```bash
# 설치 완료 후 Docker 실행
open -a Docker
```

---

## 3. 초기 설정

Docker Desktop이 처음 실행되면:

1. **서비스 약관 동의** 화면이 나타남 → Accept 클릭
2. **권한 요청** 팝업 → 비밀번호 입력하여 허용
3. 상단 메뉴바에 🐳 고래 아이콘이 나타날 때까지 대기

> ⚠️ Docker Desktop이 완전히 시작되기까지 1-2분 소요될 수 있습니다.

---

## 4. 리소스 설정 (선택)

Docker Desktop → Settings (⚙️) → Resources에서 조정 가능:

| 항목 | 권장값 | 설명 |
|------|--------|------|
| CPUs | 4개 이상 | 빌드 속도에 영향 |
| Memory | 4GB 이상 | 여러 컨테이너 실행 시 필요 |
| Disk | 20GB 이상 | 이미지 저장 공간 |

---

## ✅ 체크포인트

다음을 확인하세요:

- [ ] 상단 메뉴바에 🐳 고래 아이콘이 보인다
- [ ] 고래 아이콘이 애니메이션 없이 정지 상태이다 (시작 완료)

---

[← 목차](./README.md) | [02. Docker 확인 →](./02-docker-verify.md)
