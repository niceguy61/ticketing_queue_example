# 02. Docker 설치 확인

[← 01. Docker 설치](./01-docker-install.md) | [목차](./README.md) | [03. 프로젝트 클론 →](./03-project-clone.md)

---

⏱️ **예상 소요 시간**: 3분

## 목표

Docker가 정상적으로 설치되었는지 확인하고 기본 명령어를 익힙니다.

---

## 1. 버전 확인

터미널을 열고 다음 명령어를 실행합니다:

```bash
docker --version
```

**예상 출력:**
```
Docker version 24.0.7, build afdd53b
```

```bash
docker compose version
```

**예상 출력:**
```
Docker Compose version v2.23.0-desktop.1
```

---

## 2. Docker 데몬 상태 확인

```bash
docker info
```

**정상일 경우** 다음과 같은 정보가 출력됩니다:
```
Client:
 Version:    24.0.7
 ...
Server:
 Containers: 0
  Running: 0
  Paused: 0
  Stopped: 0
 Images: 0
 ...
```

**오류가 발생하면** [14. Docker 문제 해결](./14-trouble-docker.md)을 참고하세요.

---

## 3. Hello World 테스트

Docker가 정상 동작하는지 테스트합니다:

```bash
docker run hello-world
```

**예상 출력:**
```
Unable to find image 'hello-world:latest' locally
latest: Pulling from library/hello-world
...
Hello from Docker!
This message shows that your installation appears to be working correctly.
...
```

---

## 4. 기본 명령어 정리

앞으로 자주 사용할 명령어입니다:

| 명령어 | 설명 |
|--------|------|
| `docker ps` | 실행 중인 컨테이너 목록 |
| `docker ps -a` | 모든 컨테이너 목록 (중지 포함) |
| `docker images` | 다운로드된 이미지 목록 |
| `docker logs <컨테이너>` | 컨테이너 로그 확인 |
| `docker compose up` | docker-compose.yml 기반 서비스 시작 |
| `docker compose down` | 서비스 중지 및 컨테이너 삭제 |

---

## 5. 테스트 컨테이너 정리

hello-world 테스트로 생성된 컨테이너를 삭제합니다:

```bash
# 중지된 컨테이너 확인
docker ps -a

# hello-world 컨테이너 삭제
docker rm $(docker ps -aq --filter ancestor=hello-world)

# hello-world 이미지 삭제 (선택)
docker rmi hello-world
```

---

## ✅ 체크포인트

다음을 확인하세요:

- [ ] `docker --version` 명령이 버전 정보를 출력한다
- [ ] `docker compose version` 명령이 버전 정보를 출력한다
- [ ] `docker run hello-world`가 성공 메시지를 출력한다

---

[← 01. Docker 설치](./01-docker-install.md) | [목차](./README.md) | [03. 프로젝트 클론 →](./03-project-clone.md)
