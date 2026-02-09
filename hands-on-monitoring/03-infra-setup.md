# 03. 인프라 구축 (RabbitMQ, Redis, DB)

[← 02. 애플리케이션 빌드 및 이미지 준비](./02-build-images.md) | [목차](./README.md) | [04. 애플리케이션 통합 배포 →](./04-app-deploy.md)

---

⏱️ **예상 소요 시간**: 15분

## 목표

Kubernetes 클러스터에 애플리케이션이 필요로 하는 의존성 서비스(Database, Message Queue, Cache)를 **Helm**을 사용하여 배포합니다. Helm chart를 활용하면 복잡한 YAML 매니페스트를 직접 작성하지 않고도 검증된 설정으로 빠르게 인프라를 구성할 수 있습니다.

---

## 1. 사전 준비

### 1.1 Bitnami Helm 리포지토리 추가

Redis, PostgreSQL, RabbitMQ 모두 Bitnami에서 제공하는 Helm chart를 사용합니다.

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```

### 1.2 Namespace 및 공통 설정 생성

모든 리소스를 격리할 `ticketing` 네임스페이스와 공통 환경변수를 먼저 생성합니다.

> `kubernetes/infra-config.yaml` 파일이 이미 준비되어 있습니다.

```bash
kubectl apply -f infra-config.yaml
```

**생성되는 리소스:**
- `ticketing` Namespace
- `common-config` ConfigMap (DB_HOST, REDIS_HOST, RABBITMQ_HOST 등)
- `common-secret` Secret (DB 비밀번호, RabbitMQ 비밀번호)

---

## 2. Redis 설치 (Cache & Simple Queue)

대기열 상태 저장 및 캐싱을 위한 Redis를 Helm으로 설치합니다.

```bash
helm install redis bitnami/redis \
  --namespace ticketing \
  --set architecture=standalone \
  --set auth.enabled=false \
  --set master.resources.requests.memory=64Mi \
  --set master.resources.requests.cpu=100m \
  --set master.resources.limits.memory=128Mi \
  --set master.resources.limits.cpu=250m
```

> `auth.enabled=false`로 설정하여 실습 환경에서 비밀번호 없이 접근할 수 있도록 합니다. 운영 환경에서는 반드시 인증을 활성화하세요.

---

## 3. PostgreSQL 설치 (Database)

사용자 정보와 티켓 데이터를 저장할 PostgreSQL을 설치합니다.

```bash
helm install postgres bitnami/postgresql \
  --namespace ticketing \
  --set auth.username=postgres \
  --set auth.password=password \
  --set auth.database=ticketing \
  --set primary.resources.requests.memory=128Mi \
  --set primary.resources.requests.cpu=100m \
  --set primary.resources.limits.memory=256Mi \
  --set primary.resources.limits.cpu=500m
```

---

## 4. RabbitMQ 배포 (Message Queue)

서비스 간 비동기 메시징을 처리할 RabbitMQ를 배포합니다. Management Plugin이 포함된 공식 이미지를 사용하여 웹 UI로 상태를 확인할 수 있습니다.

> Bitnami RabbitMQ 이미지가 유료화 정책으로 pull이 안 될 수 있어, 공식 Docker Hub 이미지를 사용합니다.

### 4.1 `rabbitmq.yaml` 작성

> `kubernetes/rabbitmq.yaml` 파일이 이미 준비되어 있습니다.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rabbitmq
  namespace: ticketing
  labels:
    app: rabbitmq
spec:
  replicas: 1
  selector:
    matchLabels:
      app: rabbitmq
  template:
    metadata:
      labels:
        app: rabbitmq
    spec:
      containers:
      - name: rabbitmq
        image: rabbitmq:3-management-alpine
        env:
        - name: RABBITMQ_DEFAULT_USER
          valueFrom:
            secretKeyRef:
              name: common-secret
              key: RABBITMQ_USER
        - name: RABBITMQ_DEFAULT_PASS
          valueFrom:
            secretKeyRef:
              name: common-secret
              key: RABBITMQ_PASSWORD
        ports:
        - name: amqp
          containerPort: 5672
        - name: management
          containerPort: 15672
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: rabbitmq
  namespace: ticketing
spec:
  selector:
    app: rabbitmq
  ports:
    - name: amqp
      port: 5672
      targetPort: 5672
    - name: management
      port: 15672
      targetPort: 15672
```

### 4.2 적용하기

```bash
kubectl apply -f rabbitmq.yaml
```

---

## 5. 데이터베이스 스키마 초기화

PostgreSQL에 애플리케이션이 사용할 테이블과 초기 데이터를 생성합니다.

```bash
# PostgreSQL 비밀번호 확인
PGPASSWORD=$(kubectl get secret --namespace ticketing postgres-postgresql -o jsonpath="{.data.postgres-password}" | base64 -d)

# schema.sql 실행
kubectl exec -i postgres-postgresql-0 -n ticketing -- \
  env PGPASSWORD="$PGPASSWORD" psql -U postgres -d ticketing < ../backend/database/schema.sql
```

**예상 출력:**
```
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE INDEX
...
INSERT 0 2
INSERT 0 10
...
```

> 테이블(users, sessions, tickets, events, seats, reservations)과 이벤트 초기 데이터가 생성됩니다.

---

## 6. 설치 확인

### 6.1 Helm 릴리스 확인

```bash
helm list -n ticketing
```
**예상 출력:**
```
NAME       NAMESPACE   REVISION  STATUS    CHART                 APP VERSION
postgres   ticketing   1         deployed  postgresql-x.x.x      x.x
redis      ticketing   1         deployed  redis-x.x.x           x.x.x
```

### 6.2 파드 상태 확인

```bash
kubectl get pods -n ticketing
```
**예상 출력:**
```
NAME                        READY   STATUS    RESTARTS   AGE
postgres-postgresql-0       1/1     Running   0          2m
rabbitmq-xxxxxxxxx-xxxxx    1/1     Running   0          1m
redis-master-0              1/1     Running   0          3m
```

> ⚠️ 파드가 `Running`이 되기까지 1~2분 정도 소요될 수 있습니다. `STATUS`가 `ContainerCreating`이면 잠시 기다린 후 다시 확인하세요.

### 6.3 RabbitMQ Management 접속 테스트

```bash
kubectl port-forward svc/rabbitmq -n ticketing 15672:15672
```

브라우저에서 `http://localhost:15672` 접속.

로그인 정보는 Secret에서 확인할 수 있습니다:
```bash
# ID 확인
kubectl get secret common-secret -n ticketing -o jsonpath='{.data.RABBITMQ_USER}' | base64 -d

# PW 확인
kubectl get secret common-secret -n ticketing -o jsonpath='{.data.RABBITMQ_PASSWORD}' | base64 -d
```

로그인 후 Dashboard가 보인다면 RabbitMQ가 정상적으로 설치된 것입니다.

---

## ✅ 체크포인트

- [ ] `helm list -n ticketing`에서 2개 릴리스(redis, postgres)가 `deployed` 상태이다.
- [ ] Redis, PostgreSQL, RabbitMQ 파드가 모두 `Running` 상태이다.
- [ ] RabbitMQ Management UI (http://localhost:15672)에 접속할 수 있다.

---

[← 02. 애플리케이션 빌드 및 이미지 준비](./02-build-images.md) | [목차](./README.md) | [04. 애플리케이션 통합 배포 →](./04-app-deploy.md)
