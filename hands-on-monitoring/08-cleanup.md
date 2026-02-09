# 08. 리소스 정리 (Cleanup)

[← 07. 모니터링 실습 및 검증](./07-monitoring-practice.md) | [목차](./README.md)

---

⏱️ **예상 소요 시간**: 5분

## 목표

핸즈온 실습을 위해 생성했던 **k3d 클러스터**와 관련 리소스들을 안전하게 삭제하여 시스템을 깨끗한 상태로 되돌립니다.

---

## 1. k3d 클러스터 삭제

k3d 클러스터를 삭제하면 내부의 모든 쿠버네티스 리소스(Pod, Service, PVC 등)가 함께 삭제됩니다.

### 1.1 클러스터 삭제 명령어 실행

```bash
k3d cluster delete ticketing-cluster
```

**예상 출력:**
```
INFO[0000] Deleting cluster 'ticketing-cluster'         
INFO[0001] Deleting cluster network 'k3d-ticketing-cluster' 
INFO[0001] Deleting image volume 'k3d-ticketing-cluster-images' 
INFO[0001] Removing cluster details from default kubeconfig... 
INFO[0001] Removing standalone kubeconfig file (if there is one)... 
INFO[0001] Successfully deleted cluster ticketing-cluster!
```

---

## 2. Docker 이미지 정리 (선택 사항)

실습을 위해 빌드했던 로컬 Docker 이미지들을 삭제합니다. 공간 확보를 위해 권장되지만, 추후 다시 실습할 계획이라면 남겨두셔도 됩니다.

### 2.1 생성된 이미지 삭제

```bash
# 빌드한 서비스 이미지 삭제
docker rmi niceguy61/ticketing-frontend:latest
docker rmi niceguy61/ticketing-user-service:latest
docker rmi niceguy61/ticketing-ticket-service:latest
docker rmi niceguy61/ticketing-queue-service:latest

# (필요시) 베이스 이미지 및 도구 이미지 삭제
# 주의: 다른 프로젝트에서 사용 중일 수 있으므로 확인 후 삭제하세요.
# docker rmi rancher/k3s:v1.26.10-k3s2
# docker rmi redis:alpine
# docker rmi postgres:15-alpine
# docker rmi rabbitmq:3-management-alpine
```

---

## 3. 로컬 파일 정리

실습 과정에서 생성한 YAML 파일들이 있다면 정리합니다.

```bash
# 생성했던 매니페스트 파일들 (예시)
rm k3d-config.yaml
rm infra-config.yaml
rm redis.yaml postgres.yaml rabbitmq.yaml
rm app-config.yaml
rm queue-service.yaml ticket-service.yaml user-service.yaml frontend.yaml
rm collector.yaml instrumentation.yaml
```

---

## ✅ 체크포인트

- [ ] `k3d cluster list` 명령 실행 시 `ticketing-cluster`가 조회되지 않는다.
- [ ] Docker Dashboard 또는 CLI에서 관련 컨테이너들이 모두 제거되었다.

---

수고하셨습니다! 모든 핸즈온 과정을 완료했습니다. 👏👏👏

[목차](./README.md)
