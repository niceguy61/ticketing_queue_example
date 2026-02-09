# 01. K3s 설치 (Mac OS + k3d)

[목차](./README.md) | [02. Kubernetes 통합 모니터링 →](./02-monitoring-setup.md)

---

⏱️ **예상 소요 시간**: 10분

## 목표

macOS 환경에서 Kubernetes 학습을 위한 경량 클러스터인 **K3s**를 설치하고 구동합니다. macOS에서는 직접적인 설치보다는 Docker 컨테이너 기반으로 K3s를 실행해주는 **k3d** 도구를 사용하는 것이 가장 간편하고 표준적인 방법입니다.

---

## 1. 필수 도구 설치 (Homebrew)

macOS 패키지 관리자인 Homebrew를 사용하여 필요한 도구들을 설치합니다.

### 1.1 Docker Desktop 설치
Docker가 이미 설치되어 있다면 건너뛰세요.
```bash
brew install --cask docker
```
> 설치 후 Docker Desktop 애플리케이션을 실행하고, 트레이 아이콘에서 "Docker is running" 상태인지 확인하세요.

### 1.2 k3d 설치
Docker 컨테이너 안에서 K3s 클러스터를 실행해주는 도구입니다.
```bash
brew install k3d
```

### 1.3 kubectl 설치
Kubernetes 클러스터를 제어하기 위한 CLI 도구입니다.
```bash
brew install kubectl
```

### 1.4 Helm 설치
Kubernetes 패키지 매니저입니다. 추후 모니터링 스택 설치에 사용됩니다.
```bash
brew install helm
```

---

## 2. K3s 클러스터 생성

k3d를 사용하여 로컬 Kubernetes 클러스터를 생성합니다.

### 2.1 클러스터 설정 파일 작성
Kubernetes 관련 파일을 격리하기 위해 `kubernetes` 폴더를 생성하고, 그 안에서 작업합니다.

```bash
mkdir -p kubernetes
cd kubernetes
```

아래 내용으로 `config.yaml` 파일을 생성합니다.

```yaml
apiVersion: k3d.io/v1alpha5
kind: Simple
metadata:
  name: ticketing-cluster
servers: 1
agents: 2
kubeAPI:
  host: "0.0.0.0"
  hostIP: "0.0.0.0"
  hostPort: "6443"
image: rancher/k3s:v1.26.10-k3s2
ports:
  - port: 80:80
    nodeFilters:
      - loadbalancer
  - port: 443:443
    nodeFilters:
      - loadbalancer
  # Grafana 접근용
  - port: 3000:3000
    nodeFilters:
      - loadbalancer
  # Queue Service 접근용
  - port: 3001:3001
    nodeFilters:
      - loadbalancer
  # Prometheus 접근용 (선택)
  - port: 9090:9090
    nodeFilters:
      - loadbalancer
options:
  k3d:
    wait: true
    timeout: "60s"
    disableLoadbalancer: false
    disableImageVolume: false
    disableRollback: false
  k3s:
    extraArgs:
      - arg: --disable=traefik
        nodeFilters:
          - server:*
  kubeconfig:
    updateDefaultKubeconfig: true
    switchCurrentContext: true
```
> **참고**: 기본 Ingress Controller인 Traefik을 비활성화(`--disable=traefik`)했습니다. 추후 필요에 따라 Nginx Ingress나 쿠버네티스 게이트웨이를 직접 설치하여 실습할 수 있습니다. 모니터링 실습에서는 포트 포워딩을 주로 사용할 예정이나, 로드밸런서 포트 매핑을 미리 해두었습니다.

### 2.2 클러스터 생성 실행

```bash
k3d cluster create --config config.yaml
```

**예상 출력:**
```
INFO[0000] Prep: Network                                
INFO[0000] Created network 'k3d-ticketing-cluster'      
INFO[0000] Created image volume k3d-ticketing-cluster-images 
INFO[0000] Starting new tools node...                   
INFO[0001] Starting Node 'k3d-ticketing-cluster-tools'  
INFO[0002] Creating node 'k3d-ticketing-cluster-server-0' 
INFO[0002] Creating node 'k3d-ticketing-cluster-agent-0' 
INFO[0002] Creating node 'k3d-ticketing-cluster-agent-1' 
INFO[0002] Creating LoadBalancer 'k3d-ticketing-cluster-serverlb' 
...
INFO[0009] Cluster 'ticketing-cluster' created successfully!
```

---

## 3. 설치 확인

### 3.1 노드 상태 확인
```bash
kubectl get nodes
```
**예상 출력**:
```
NAME                             STATUS   ROLES                  AGE     VERSION
k3d-ticketing-cluster-agent-0    Ready    <none>                 2m      v1.26.10+k3s2
k3d-ticketing-cluster-agent-1    Ready    <none>                 2m      v1.26.10+k3s2
k3d-ticketing-cluster-server-0   Ready    control-plane,master   2m      v1.26.10+k3s2
```

> ⚠️ 클러스터 생성 직후에는 아래와 같은 에러가 함께 출력될 수 있습니다.
> ```
> E0209 memcache.go:287] "Unhandled Error" err="couldn't get resource list for metrics.k8s.io/v1beta1: the server is currently unable to handle the request"
> ```
> metrics-server 파드가 아직 완전히 기동되지 않아서 발생하는 것으로, **정상적인 현상**입니다. 노드 상태가 모두 `Ready`이면 무시하고 진행하세요. 1~2분 후 재실행하면 사라집니다.

### 3.2 전체 파드 확인
```bash
kubectl get pods -A
```
모든 시스템 파드(coredns, metrics-server 등)가 `Running` 상태인지 확인합니다.

---

## ✅ 체크포인트

- [ ] `docker`, `k3d`, `kubectl`, `helm` 명령어가 정상 동작한다.
- [ ] `k3d cluster create` 명령으로 클러스터가 성공적으로 생성되었다.
- [ ] `kubectl get nodes` 명령 실행 시 1개의 server(master)와 2개의 agent(worker) 노드가 `Ready` 상태로 조회된다.

---

[목차](./README.md) | [02. 애플리케이션 빌드 및 이미지 준비 →](./02-build-images.md)
