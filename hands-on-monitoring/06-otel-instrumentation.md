# 06. OpenTelemetry 연동 설정

[← 05. 모니터링 인프라 구축](./05-monitoring-setup.md) | [목차](./README.md) | [07. 모니터링 실습 및 검증 →](./07-monitoring-practice.md)

---

⏱️ **예상 소요 시간**: 15분

## 목표

애플리케이션의 메트릭, 로그, 트레이스 데이터를 수집하여 이전 단계에서 구축한 모니터링 인프라(LGTM)로 전송하도록 설정합니다. **OpenTelemetry Collector**를 구성하고, **Auto-Instrumentation**을 통해 애플리케이션에 OTel 에이전트를 주입합니다.

---

## 1. OTel Collector 설정

OTel Collector는 애플리케이션에서 발생한 데이터를 받아 처리(Process)하고, 목적지(Exporter)로 전송하는 파이프라인 역할을 합니다.

### 1.1 `collector.yaml` 작성

Deployment 모드로 실행하여 중앙 집중식으로 데이터를 수집합니다.

```yaml
apiVersion: opentelemetry.io/v1alpha1
kind: OpenTelemetryCollector
metadata:
  name: otel-collector
  namespace: ticketing
spec:
  mode: deployment
  config: |
    receivers:
      otlp:
        protocols:
          grpc:
          http:

    processors:
      batch:

    exporters:
      # Prometheus로 메트릭 내보내기 (Scrape 대상이 됨)
      prometheus:
        endpoint: "0.0.0.0:8889"
      
      # Tempo로 트레이스 내보내기
      otlp:
        endpoint: "tempo.monitoring.svc.cluster.local:4317"
        tls:
          insecure: true
      
      # Loki로 로그 내보내기 (HTTP API 사용)
      loki:
        endpoint: "http://loki.monitoring.svc.cluster.local:3100/loki/api/v1/push"

    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [batch]
          exporters: [otlp]
        metrics:
          receivers: [otlp]
          processors: [batch]
          exporters: [prometheus]
        logs:
          receivers: [otlp]
          processors: [batch]
          exporters: [loki]
```

**적용하기:**
```bash
kubectl apply -f collector.yaml
```

---

## 2. Auto-Instrumentation 설정

애플리케이션 코드 수정 없이 자동으로 OTel SDK를 주입하는 설정입니다.

### 2.1 `instrumentation.yaml` 작성

Node.js 애플리케이션용 자동 주입 설정을 정의합니다.

```yaml
apiVersion: opentelemetry.io/v1alpha1
kind: Instrumentation
metadata:
  name: my-instrumentation
  namespace: ticketing
spec:
  exporter:
    endpoint: "http://otel-collector-collector.ticketing.svc.cluster.local:4317"
  propagators:
    - tracecontext
    - baggage
    - b3
  nodejs:
    image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-nodejs:latest
```

**적용하기:**
```bash
kubectl apply -f instrumentation.yaml
```

---

## 3. 애플리케이션 재시작 (사이드카 주입)

이전에 배포한 애플리케이션(`step 04`)에는 이미 `instrumentation.opentelemetry.io/inject-nodejs: "true"` 어노테이션이 추가되어 있습니다. 하지만 배포 당시에는 OTel Operator가 없었으므로 주입되지 않았습니다.

이제 파드를 재시작하여 init-container가 주입되도록 합니다.

```bash
# 모든 디플로이먼트 재시작 (롤아웃)
kubectl rollout restart deployment queue-service -n ticketing
kubectl rollout restart deployment ticket-service -n ticketing
kubectl rollout restart deployment user-service -n ticketing
```

---

## 4. 연동 확인

### 4.1 파드 상태 확인

```bash
kubectl get pods -n ticketing
```
파드 이름 옆의 컨테이너 수가 `n/n`으로 이전에 비해 늘어났거나, describe 명령어로 확인했을 때 init-container가 실행되었는지 확인합니다.

```bash
# 예시: queue-service 파드 상세 확인
kubectl describe pod -l app=queue-service -n ticketing | grep "Init Containers" -A 5
```
**예상 출력에 `opentelemetry-auto-instrumentation`이 포함되어 있어야 합니다.**

---

## ✅ 체크포인트

- [ ] `ticketing` 네임스페이스에 `otel-collector` 파드가 실행 중이다.
- [ ] `ticketing` 네임스페이스에 `my-instrumentation` 리소스가 생성되었다.
- [ ] 애플리케이션 파드(queue, ticket, user)가 재시작되었으며, OTel init-container가 주입되었다.

---

[← 05. 모니터링 인프라 구축](./05-monitoring-setup.md) | [목차](./README.md) | [07. 모니터링 실습 및 검증 →](./07-monitoring-practice.md)
