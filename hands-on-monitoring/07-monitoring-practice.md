# 07. 모니터링 실습 및 검증 (로그, 트레이스, 메트릭)

[← 06. OpenTelemetry 연동 설정](./06-otel-instrumentation.md) | [목차](./README.md)

---

⏱️ **예상 소요 시간**: 20분

## 목표

실제로 트래픽을 발생시켜 **Grafana**를 통해 애플리케이션의 상태를 모니터링합니다. **Loki(로그)**, **Tempo(트레이스)**, **Prometheus(메트릭)** 데이터를 연계하여 분석하는 방법을 익히고, 시스템의 **RED** (Rate, Errors, Duration) 지표를 확인합니다.

---

## 1. 트래픽 생성 및 시나리오 실행

이제 실제로 모니터링할 데이터를 생성해보겠습니다. 사용자 역할을 가정하고 **로비 진입 → 대기열 통과 → 티켓 발급**으로 이어지는 시나리오를 실행합니다.

### 1.1 트래픽 발생 스크립트 (CLI)

아래 명령어를 터미널에서 실행하여 여러 건의 요청을 발생시킵니다. (약 1분간 반복 실행 권장)

```bash
# 1. 포트 포워딩 (Queue Service, User Service) - 터미널 1
kubectl port-forward svc/queue-service -n ticketing 3001:3001 &
kubectl port-forward svc/user-service -n ticketing 3003:3003 &

# 2. 트래픽 생성 (터미널 2)
# 10명의 사용자를 등록하고 1초 간격으로 대기열에 진입하는 시나리오
../scripts/generate-traffic.sh 10
```

> `generate-traffic.sh`는 user-service에 회원가입하여 UUID를 발급받은 뒤, 해당 UUID로 queue-service 대기열에 진입합니다. 인자로 사용자 수를 지정할 수 있습니다 (기본값: 10).

> **팁**: 더 많은 트래픽을 원한다면 `ab` (Apache Benchmark)나 `k6` 같은 도구를 사용할 수 있지만, 이번 실습에서는 위 스크립트로 충분합니다.

---

## 2. Grafana 상세 모니터링 가이드

이제 발생시킨 트래픽을 Grafana에서 단계별로 확인해보겠습니다. **로그(Loki) → 트레이스(Tempo) → 메트릭(Prometheus)** 순서로 분석하는 것이 정석입니다.

### 2.1 Grafana 접속 준비

```bash
# admin 비밀번호 확인
kubectl get secret --namespace monitoring kube-prometheus-stack-grafana -o jsonpath="{.data.admin-password}" | base64 --decode ; echo

# 포트 포워딩
kubectl port-forward --namespace monitoring svc/kube-prometheus-stack-grafana 3000:80
```

1. 브라우저에서 `http://localhost:3000` 접속 (ID: `admin`, PW: 위에서 확인한 값)
2. **Configuration -> Data Sources** 이동
3. **Add data source** 클릭 및 설정:
    - **Prometheus**: URL `http://kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090` (기본값)
    - **Loki**: URL `http://loki.monitoring.svc.cluster.local:3100`
    - **Tempo**: URL `http://tempo.monitoring.svc.cluster.local:3100`

### 2.2 [Step 1] 로그 분석 (Loki) - "무슨 일이 있었나?"

가장 먼저 애플리케이션 로그를 통해 개별 요청의 흐름을 파악합니다.

1. 좌측 메뉴 **Explore** (나침반 아이콘) 클릭
2. 상단 데이터 소스에서 **Loki** 선택
3. **Label browser** 클릭
    - `app` 레이블 선택
    - `queue-service` 값 선택
    - **Show logs** 버튼 클릭
4. 로그 검색창에 `Joined queue` 입력 후 **Run query** (우측 상단 파란 버튼)

> **확인 포인트**: `user-xxxxx` 사용자가 대기열에 진입했다는 로그가 시간 순서대로 보이는지 확인하세요.

<!-- TODO: [스크린샷 1] Grafana Explore - Loki 로그 조회 화면 -->
![Grafana Loki Log Explore](images/grafana-loki-logs.png)

### 2.3 [Step 2] 분산 트레이싱 (Tempo) - "어디서 느려졌나?"

로그만으로는 서비스 간의 호출 관계나 지연 시간을 알기 어렵습니다. 트레이스 ID를 통해 전체 흐름을 추적합니다.

1. 위 Loki 로그 목록에서 아무 로그 라인이나 클릭하여 상세 정보를 펼칩니다.
2. 로그 메시지 옆에 **TraceID** 버튼(파란색 링크)이 보인다면 클릭합니다.
    - *참고: OTel 자동 계측은 로그에 TraceID를 자동으로 주입합니다.*
3. 화면이 **Tempo** 탭으로 자동 전환되며, 해당 요청의 **전체 실행 경로(Gantt Chart)**가 표시됩니다.

> **확인 포인트**:
> - `queue-service`가 `redis`나 `db`를 호출하는 구간(Span)이 보이는가?
> - 전체 요청 중 가장 시간이 오래 걸린 구간은 어디인가?

<!-- TODO: [스크린샷 2] Grafana Explore - Tempo 트레이스 상세 화면 -->
![Grafana Tempo Trace View](images/grafana-tempo-trace.png)

### 2.4 [Step 3] 메트릭 대시보드 (Prometheus) - "시스템 상태는 어떤가?"

개별 요청이 아닌, 시스템 전체의 건강 상태를 봅니다. Node.js 애플리케이션의 핵심 지표를 확인합니다.

1. 좌측 메뉴 **Dashboards** 클릭 -> **New** -> **Import**
2. **Import via grafana.com** 입력창에 `11159` (Node.js Application Dashboard) 입력 후 **Load**
3. 데이터 소스로 **Prometheus** 선택 후 **Import**
4. 생성된 대시보드 확인

> **확인 포인트**:
> - **Process CPU usage**: CPU 사용량 변화 (스파이크 확인)
> - **Heap Size**: 메모리 사용량 변화 (누수 확인)
> - **Event Loop Lag**: Node.js 싱글 스레드 지연 시간 (중요!)

<!-- TODO: [스크린샷 3] Grafana Dashboard - Node.js 메트릭 대시보드 -->
![Grafana Node.js Dashboard](images/grafana-nodejs-dashboard.png)

---

## 3. 핵심 모니터링 체크리스트 (What to Watch)

실무에서 반드시 확인해야 할 주요 모니터링 항목입니다.

### 3.1 RED 메소드 (서비스 관점)
| 항목 | 설명 | Prometheus 지표 예시 |
|------|------|-------------------|
| **Rate** (요청량) | 초당 얼마나 많은 요청이 들어오는가? | `rate(http_request_duration_seconds_count[1m])` |
| **Errors** (에러율) | 실패한 요청 비율은 얼마나 되는가? | `rate(http_request_duration_seconds_count{status_code=~"5.."}[1m])` |
| **Duration** (응답시간) | 요청 처리에 얼마나 걸리는가? (P95, P99) | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[1m]))` |

### 3.2 USE 메소드 (리소스 관점)
| 항목 | 설명 | 확인 방법 |
|------|------|----------|
| **Utilization** (사용률) | CPU/메모리를 얼마나 쓰고 있는가? | Kubernetes Pod Metrics |
| **Saturation** (포화도) | 처리되지 못하고 대기 중인 작업이 있는가? | Node.js Event Loop Lag |
| **Errors** (에러) | 하드웨어나 시스템 레벨 에러가 있는가? | Pod Restart Count, OOMKilled |

---

## ✅ 체크포인트

- [ ] **Loki**: `queue-service`의 로그를 검색하고, 특정 사용자의 요청 로그를 찾을 수 있다.
- [ ] **Tempo**: 로그에서 TraceID를 클릭하여 해당 요청의 전체 트랜잭션 흐름을 시각적으로 확인할 수 있다.
- [ ] **Prometheus**: Node.js 대시보드를 통해 CPU, 메모리, Event Loop 지연 상태를 확인할 수 있다.

---

[← 06. OpenTelemetry 연동 설정](./06-otel-instrumentation.md) | [목차](./README.md) | [08. 리소스 정리 (Cleanup) →](./08-cleanup.md)
