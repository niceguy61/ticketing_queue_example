# 04. 애플리케이션 통합 배포

[← 03. 인프라 구축 (RabbitMQ, DB)](./03-infra-setup.md) | [목차](./README.md) | [05. Kubernetes 통합 모니터링 →](./05-monitoring-setup.md)

---

⏱️ **예상 소요 시간**: 20분

## 목표

기존에 빌드해둔 4개의 마이크로서비스(Frontend, Queue, Ticket, User)를 Kubernetes에 배포합니다. 이 과정에서 **OpenTelemetry Auto-Instrumentation**을 위한 어노테이션(Annotation)을 추가하여, 별도의 코드 수정 없이 애플리케이션의 성능 데이터를 수집할 준비를 합니다.

---

## 1. 애플리케이션 공통 ConfigMap

각 서비스가 참조할 환경변수를 `ConfigMap`으로 정의합니다. 이전 단계에서 생성한 DB, Redis, RabbitMQ 연결 정보를 활용합니다.

### 1.1 `app-config.yaml` 작성

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: ticketing
data:
  # 서비스 포트 설정
  PORT: "3000"
  
  # 인프라 연결 정보 (Service 이름으로 DNS 조회)
  DB_HOST: "postgres"
  REDIS_HOST: "redis"
  RABBITMQ_HOST: "rabbitmq"
  
  # 서비스 URL (ClusterIP DNS)
  QUEUE_SERVICE_URL: "http://queue-service:3001"
  TICKET_SERVICE_URL: "http://ticket-service:3002"
  USER_SERVICE_URL: "http://user-service:3003"
  
  # 로깅 레벨
  LOG_LEVEL: "info"
```

### 1.2 적용하기

```bash
kubectl apply -f app-config.yaml
```

---

## 2. 백엔드 서비스 배포

### 2.1 Queue Service (대기열 관리)

대기열 상태를 관리하고, 프론트엔드와 소켓 통신을 담당하는 핵심 서비스입니다.

**`queue-service.yaml` 작성:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: queue-service
  namespace: ticketing
  labels:
    app: queue-service
spec:
  replicas: 1
  selector:
    matchLabels:
      app: queue-service
  template:
    metadata:
      labels:
        app: queue-service
      annotations:
        # [중요] OpenTelemetry Auto-Instrumentation 활성화
        # 이 어노테이션이 있으면 OTel Operator가 자동으로 Node.js 에이전트를 주입합니다.
        instrumentation.opentelemetry.io/inject-nodejs: "true"
    spec:
      containers:
      - name: queue-service
        image: niceguy61/ticketing-queue-service:latest
        imagePullPolicy: IfNotPresent  # 로컬 이미지를 우선 사용
        ports:
        - containerPort: 3001
        env:
        - name: PORT
          value: "3001"
        - name: QUEUE_MODE
          value: "advanced"  # 'simple' 또는 'advanced'
        # DB 연결 정보 주입
        - name: DB_Host
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_HOST
        # Redis 연결 정보 주입
        - name: REDIS_HOST
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: REDIS_HOST
        # RabbitMQ 연결 정보 주입
        - name: RABBITMQ_URL
          value: "amqp://guest:guest@rabbitmq:5672"

---
apiVersion: v1
kind: Service
metadata:
  name: queue-service
  namespace: ticketing
spec:
  selector:
    app: queue-service
  ports:
    - port: 3001
      targetPort: 3001
```

### 2.2 Ticket Service (티켓 발급)

티켓 생성 및 검증을 담당하는 서비스입니다.

**`ticket-service.yaml` 작성:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ticket-service
  namespace: ticketing
  labels:
    app: ticket-service
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ticket-service
  template:
    metadata:
      labels:
        app: ticket-service
      annotations:
        # [중요] OpenTelemetry 활성화
        instrumentation.opentelemetry.io/inject-nodejs: "true"
    spec:
      containers:
      - name: ticket-service
        image: niceguy61/ticketing-ticket-service:latest
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 3002
        env:
        - name: PORT
          value: "3002"
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_HOST

---
apiVersion: v1
kind: Service
metadata:
  name: ticket-service
  namespace: ticketing
spec:
  selector:
    app: ticket-service
  ports:
    - port: 3002
      targetPort: 3002
```

### 2.3 User Service (회원 관리)

사용자 정보 관리 및 인증을 담당하는 서비스입니다.

**`user-service.yaml` 작성:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  namespace: ticketing
  labels:
    app: user-service
spec:
  replicas: 1
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
      annotations:
        # [중요] OpenTelemetry 활성화
        instrumentation.opentelemetry.io/inject-nodejs: "true"
    spec:
      containers:
      - name: user-service
        image: niceguy61/ticketing-user-service:latest
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 3003
        env:
        - name: PORT
          value: "3003"
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_HOST

---
apiVersion: v1
kind: Service
metadata:
  name: user-service
  namespace: ticketing
spec:
  selector:
    app: user-service
  ports:
    - port: 3003
      targetPort: 3003
```

### 2.4 배치 적용

```bash
kubectl apply -f queue-service.yaml
kubectl apply -f ticket-service.yaml
kubectl apply -f user-service.yaml
```

---

## 3. 프론트엔드 배포

사용자 인터페이스를 제공하는 React 애플리케이션을 배포합니다.

**`frontend.yaml` 작성:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: ticketing
  labels:
    app: frontend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
        # 프론트엔드(Nginx)는 Node.js 인스트루멘테이션 대상이 아님
    spec:
      containers:
      - name: frontend
        image: niceguy61/ticketing-frontend:latest
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 80

---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: ticketing
spec:
  # LoadBalancer 타입으로 외부 노출 (k3d가 호스트 포트로 포워딩해줌)
  type: LoadBalancer
  selector:
    app: frontend
  ports:
    - port: 80
      targetPort: 80
```

### 3.1 적용하기

```bash
kubectl apply -f frontend.yaml
```

---

## 4. 배포 확인 및 접속 테스트

### 4.1 파드 상태 확인

```bash
kubectl get pods -n ticketing
```
모든 파드가 `Running` 상태여야 합니다. 
> **주의**: 아직 OTel Operator를 설치하지 않았으므로, `instrumentation` 어노테이션이 있더라도 사이드카가 주입되지 않은 상태로 정상 실행됩니다. 다음 단계에서 Operator를 설치하고 파드를 재시작하면 자동으로 주입됩니다.

### 4.2 접속 테스트

브라우저에서 `http://localhost:8080` (또는 k3d 생성 시 매핑한 80 포트)로 접속하여 프론트엔드가 보이는지 확인합니다.

---

## ✅ 체크포인트

- [ ] 3개의 백엔드 서비스(queue, ticket, user)와 1개의 프론트엔드 서비스가 `Running` 상태이다.
- [ ] 브라우저를 통해 프론트엔드에 접속할 수 있다.
- [ ] 각 Deployment YAML에 `instrumentation.opentelemetry.io/inject-nodejs: "true"` 어노테이션이 포함되어 있다.

---

[← 03. 인프라 구축 (RabbitMQ, DB)](./03-infra-setup.md) | [목차](./README.md) | [05. Kubernetes 통합 모니터링 →](./05-monitoring-setup.md)
