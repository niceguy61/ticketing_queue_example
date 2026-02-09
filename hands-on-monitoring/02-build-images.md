# 02. 애플리케이션 빌드 및 이미지 준비

[← 01. K3s 설치 (Mac OS + k3d)](./01-k3s-install.md) | [목차](./README.md) | [03. 인프라 구축 (RabbitMQ, DB) →](./03-infra-setup.md)

---

⏱️ **예상 소요 시간**: 10분

## 목표

backend와 frontend 소스를 Docker 이미지로 빌드하고, 생성한 k3d 클러스터 내부로 이미지를 import 합니다. 로컬 개발 환경에서는 Docker Hub와 같은 외부 레지스트리를 사용하는 대신 **k3d 이미지 로드 기능**을 사용하는 것이 훨씬 빠르고 효율적입니다.

---

## 1. Docker 이미지 빌드

프로젝트 루트 디렉토리에서 스크립트를 사용하여 모든 서비스의 이미지를 빌드합니다.

### 1.1 빌드 스크립트 실행

`scripts/build-images.sh` 스크립트가 이미 준비되어 있습니다. (Windows 사용자는 `build-images.ps1` 사용 가능하나, 여기서는 macOS/Linux 기준 shell script를 사용합니다.)

```bash
# 프로젝트 루트 디렉토리로 이동
cd ../

# 실행 권한 부여
chmod +x scripts/build-images.sh

# 이미지 빌드 실행
./scripts/build-images.sh
```

**빌드되는 이미지 목록:**
- `niceguy61/ticketing-queue-service:latest`
- `niceguy61/ticketing-ticket-service:latest`
- `niceguy61/ticketing-user-service:latest`
- `niceguy61/ticketing-frontend:latest`

### 1.2 빌드된 이미지 확인

```bash
docker images | grep niceguy61
```
**예상 출력:**
```
niceguy61/ticketing-frontend        latest    ...
niceguy61/ticketing-user-service    latest    ...
niceguy61/ticketing-ticket-service  latest    ...
niceguy61/ticketing-queue-service   latest    ...
```

---

## 2. k3d 클러스터로 이미지 가져오기 (Image Import)

k3d는 로컬 Docker 데몬에 있는 이미지를 클러스터 내부의 컨테이너 런타임으로 직접 복사하는 기능을 제공합니다. 이를 통해 별도의 레지스트리 구축 없이도 이미지를 사용할 수 있습니다.

### 2.1 이미지 Import 실행

`k3d image import` 명령어를 사용하여 4개의 이미지를 `ticketing-cluster`로 가져옵니다.

```bash
k3d image import -c ticketing-cluster \
  niceguy61/ticketing-queue-service:latest \
  niceguy61/ticketing-ticket-service:latest \
  niceguy61/ticketing-user-service:latest \
  niceguy61/ticketing-frontend:latest
```

**예상 출력:**
```
INFO[0000] Importing into node 'k3d-ticketing-cluster-server-0'... 
INFO[0000] Importing into node 'k3d-ticketing-cluster-agent-0'... 
INFO[0000] Importing into node 'k3d-ticketing-cluster-agent-1'... 
INFO[0005] Successfully imported niceguy61/ticketing-queue-service:latest
...
INFO[0020] Cluster 'ticketing-cluster' imported images successfully!
```

> **팁**: 이미지를 수정한 후 다시 빌드했다면, 반드시 이 단계(Import)를 다시 수행해야 클러스터에 반영됩니다. k3d는 이미지 태그가 같아도 내부 해시가 변경되면 업데이트합니다.

---

## ✅ 체크포인트

- [ ] 4개의 서비스 이미지가 로컬 Docker에 정상적으로 빌드되었다.
- [ ] `k3d image import` 명령이 성공적으로 완료되었다.
- [ ] (선택) `docker exec -it k3d-ticketing-cluster-agent-0 crictl images | grep niceguy61` 명령으로 노드 내부에서 이미지가 조회된다.

---

[← 01. K3s 설치 (Mac OS + k3d)](./01-k3s-install.md) | [목차](./README.md) | [03. 인프라 구축 (RabbitMQ, DB) →](./03-infra-setup.md)
