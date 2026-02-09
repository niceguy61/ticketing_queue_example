# 05. 모니터링 인프라 구축 (LGTM + OTel Operator)

[← 04. 애플리케이션 통합 배포](./04-app-deploy.md) | [목차](./README.md) | [06. OpenTelemetry 연동 설정 →](./06-otel-instrumentation.md)

---

⏱️ **예상 소요 시간**: 10분

## 목표

Kubernetes 환경에서 관찰성(Observability) 데이터를 수집하고 저장하기 위한 인프라를 구축합니다. **LGTM 스택 (Loki, Grafana, Tempo, Prometheus)** 과 **OpenTelemetry Operator**를 Helm을 통해 설치합니다.

---

## 1. 사전 준비

이전 단계에서 애플리케이션이 `ticketing` 네임스페이스에 배포되어 있어야 합니다.

```bash
# 네임스페이스 확인
kubectl get ns ticketing
```

모니터링 도구를 위한 전용 네임스페이스를 생성합니다.
```bash
kubectl create ns monitoring
```

---

## 2. LGTM 스택 설치 (Helm)

Prometheus(메트릭), Grafana(시각화), Loki(로그), Tempo(트레이스)를 설치합니다.

### 2.1 Helm 리포지토리 추가

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
```

### 2.2 Prometheus & Grafana 설치

```bash
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set grafana.enabled=true \
  --set prometheus.enabled=true
```

### 2.3 Loki (로그) 설치

```bash
helm install loki grafana/loki-stack \
  --namespace monitoring \
  --set grafana.enabled=false \
  --set prometheus.enabled=false \
  --set prometheus.isDefault=false \
  --set loki.isDefault=false
```

### 2.4 Tempo (트레이싱) 설치

```bash
helm install tempo grafana/tempo \
  --namespace monitoring
```

---

## 3. OpenTelemetry Operator 설치

애플리케이션에 OTel 에이전트를 자동으로 주입하고 관리해주는 Operator를 설치합니다.

```bash
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update

helm install opentelemetry-operator open-telemetry/opentelemetry-operator \
  --namespace monitoring \
  --set "manager.collectorImage.repository=otel/opentelemetry-collector-k8s"
```

---

## 4. 설치 확인

모든 모니터링 인프라가 정상적으로 구동 중인지 확인합니다.

```bash
kubectl get pods -n monitoring
```

**예상 출력 (모두 Running 상태여야 함):**
- `kube-prometheus-stack-operator...`
- `kube-prometheus-stack-prometheus...`
- `kube-prometheus-stack-grafana...`
- `loki-0`
- `tempo-0`
- `opentelemetry-operator...`

---

## ✅ 체크포인트

- [ ] `monitoring` 네임스페이스에 Prometheus, Grafana, Loki, Tempo 파드가 실행 중이다.
- [ ] `monitoring` 네임스페이스에 opentelemetry-operator 파드가 실행 중이다.

---

[← 04. 애플리케이션 통합 배포](./04-app-deploy.md) | [목차](./README.md) | [06. OpenTelemetry 연동 설정 →](./06-otel-instrumentation.md)
