# 05. 모니터링 인프라 구축 (LGTM + OTel Operator)

[← 04. 애플리케이션 통합 배포](./04-app-deploy.md) | [목차](./README.md) | [06. OpenTelemetry 연동 설정 →](./06-otel-instrumentation.md)

---

⏱️ **예상 소요 시간**: 15분

## 목표

Kubernetes 환경에서 관찰성(Observability) 데이터를 수집하고 저장하기 위한 인프라를 구축합니다. **LGTM 스택 (Loki, Grafana, Tempo, Prometheus)** 과 **OpenTelemetry Operator**를 Helm을 통해 설치합니다.

---

## 1. 사전 준비

이전 단계에서 애플리케이션이 `ticketing` 네임스페이스에 배포되어 있어야 합니다.

```bash
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

Grafana에 Loki, Tempo 데이터소스를 자동으로 프로비저닝하기 위해 values 파일을 사용합니다.

> `kubernetes/grafana-values.yaml` 파일이 이미 준비되어 있습니다.

```yaml
# kubernetes/grafana-values.yaml
grafana:
  additionalDataSources:
    - name: Loki
      type: loki
      url: http://loki.monitoring.svc.cluster.local:3100
      access: proxy
      isDefault: false
    - name: Tempo
      type: tempo
      url: http://tempo.monitoring.svc.cluster.local:3200
      access: proxy
      isDefault: false
```

```bash
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  -f grafana-values.yaml
```

> Grafana에 Prometheus(기본), Loki, Tempo 데이터소스가 자동으로 추가됩니다.

### 2.3 Loki (로그) 설치

```bash
helm install loki grafana/loki-stack \
  --namespace monitoring \
  --set grafana.enabled=false \
  --set prometheus.enabled=false
```

> `grafana.enabled=false`로 설정하여 Grafana 중복 설치를 방지합니다. Loki 데이터소스는 2.2에서 이미 프로비저닝했습니다.

### 2.4 Tempo (트레이싱) 설치

```bash
helm install tempo grafana/tempo \
  --namespace monitoring
```

---

## 3. cert-manager 설치

OpenTelemetry Operator는 Webhook 인증서 관리를 위해 **cert-manager**가 필요합니다.

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.5/cert-manager.yaml
```

cert-manager 파드가 모두 Running 상태가 될 때까지 기다립니다.

```bash
kubectl get pods -n cert-manager
```

**예상 출력:**
```
NAME                                      READY   STATUS    RESTARTS   AGE
cert-manager-cainjector-xxxxx             1/1     Running   0          1m
cert-manager-xxxxx                        1/1     Running   0          1m
cert-manager-webhook-xxxxx                1/1     Running   0          1m
```

> ⚠️ cert-manager 파드가 모두 Running이 된 후에 다음 단계를 진행하세요. 준비되지 않은 상태에서 OTel Operator를 설치하면 실패합니다.

---

## 4. OpenTelemetry Operator 설치

애플리케이션에 OTel 에이전트를 자동으로 주입하고 관리해주는 Operator를 설치합니다.

```bash
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update

helm install opentelemetry-operator open-telemetry/opentelemetry-operator \
  --namespace monitoring \
  --set "manager.collectorImage.repository=otel/opentelemetry-collector-k8s"
```

---

## 5. 설치 확인

모든 모니터링 인프라가 정상적으로 구동 중인지 확인합니다.

```bash
kubectl get pods -n monitoring
```

**예상 출력 (모두 Running 상태여야 함):**
- `kube-prometheus-stack-operator-...`
- `kube-prometheus-stack-prometheus-...`
- `kube-prometheus-stack-grafana-...`
- `loki-0`
- `loki-promtail-...` (DaemonSet, 노드 수만큼)
- `tempo-0`
- `opentelemetry-operator-...`

> ⚠️ 일부 파드가 `ContainerCreating` 상태일 수 있습니다. 1~2분 후 다시 확인하세요.

---

## ✅ 체크포인트

- [ ] `monitoring` 네임스페이스에 Prometheus, Grafana, Loki, Tempo 파드가 실행 중이다.
- [ ] `cert-manager` 네임스페이스에 cert-manager 파드가 실행 중이다.
- [ ] `monitoring` 네임스페이스에 opentelemetry-operator 파드가 실행 중이다.

---

[← 04. 애플리케이션 통합 배포](./04-app-deploy.md) | [목차](./README.md) | [06. OpenTelemetry 연동 설정 →](./06-otel-instrumentation.md)
