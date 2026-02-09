# 03. 인프라 구축 (RabbitMQ, Redis, DB)

[← 02. 애플리케이션 빌드 및 이미지 준비](./02-build-images.md) | [목차](./README.md) | [04. 애플리케이션 통합 배포 →](./04-app-deploy.md)

---

⏱️ **예상 소요 시간**: 15분

## 목표

Kubernetes 클러스터에 애플리케이션이 필요로 하는 의존성 서비스(Database, Message Queue, Cache)를 배포합니다. 이 단계에서는 **Namespace**, **ConfigMap**, **Secret**, **Deployment**, **Service** 리소스를 직접 작성하여 생성합니다.

---

## 1. Namespace 및 공통 설정

먼저 모든 리소스를 격리할 `ticketing` 네임스페이스와 공통 환경변수를 정의합니다.

### 1.1 `infra-config.yaml` 작성

> 아래 내용을 복사하여 `infra-config.yaml` 파일로 저장하세요.

```yaml
# 1. Namespace 생성
# 모든 리소스를 'ticketing' 네임스페이스에 격리하여 관리합니다.
apiVersion: v1
kind: Namespace
metadata:
  name: ticketing

---
# 2. ConfigMap - 공통 환경설정
# 애플리케이션 및 인프라 서비스에서 공유할 설정값들을 정의합니다.
apiVersion: v1
kind: ConfigMap
metadata:
  name: common-config
  namespace: ticketing
data:
  # 데이터베이스 연결 정보
  DB_HOST: "postgres"
  DB_PORT: "5432"
  DB_NAME: "ticketing"
  
  # Redis 연결 정보
  REDIS_HOST: "redis"
  REDIS_PORT: "6379"
  
  # RabbitMQ 연결 정보 (Message Queue)
  RABBITMQ_HOST: "rabbitmq"
  RABBITMQ_PORT: "5672"
  QUEUE_PROVIDER: "rabbitmq"  # 큐 서비스 공급자로 RabbitMQ 선택

---
# 3. Secret - 민감 정보
# 비밀번호와 같은 민감한 데이터는 base64로 인코딩되어 저장됩니다.
# (여기서는 편의상 평문 stringData를 사용하며, 실제 운영 환경에서는 암호화 관리가 필요합니다.)
apiVersion: v1
kind: Secret
metadata:
  name: common-secret
  namespace: ticketing
type: Opaque
stringData:
  # DB 사용자 비밀번호
  DB_USER: "postgres"
  DB_PASSWORD: "password"
  
  # RabbitMQ 사용자 비밀번호
  RABBITMQ_USER: "guest"
  RABBITMQ_PASSWORD: "guest"
```

### 1.2 적용하기

```bash
kubectl apply -f infra-config.yaml
```

---

## 2. Redis 배포 (Cache & Simple Queue)

대기열 상태 저장 및 캐싱을 위한 Redis를 배포합니다.

### 2.1 `redis.yaml` 작성

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: ticketing
  labels:
    app: redis
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:alpine
        ports:
        - containerPort: 6379
        resources:
          requests:
            memory: "64Mi"
            cpu: "100m"
          limits:
            memory: "128Mi"
            cpu: "250m"

---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: ticketing
spec:
  selector:
    app: redis
  ports:
    - port: 6379
      targetPort: 6379
```

### 2.2 적용하기

```bash
kubectl apply -f redis.yaml
```

---

## 3. PostgreSQL 배포 (Database)

사용자 정보와 티켓 데이터를 저장할 PostgreSQL 데이터베이스를 배포합니다.

### 3.1 `postgres.yaml` 작성

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: ticketing
  labels:
    app: postgres
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        # Secret에서 환경변수 주입
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: common-secret
              key: DB_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: common-secret
              key: DB_PASSWORD
        - name: POSTGRES_DB
          valueFrom:
            configMapKeyRef:
              name: common-config
              key: DB_NAME
        ports:
        - containerPort: 5432
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
        # 데이터 영속성을 위한 볼륨 마운트 (실습용 local path 사용하지 않음 - Pod 재시작 시 데이터 초기화됨)
        # 운영 환경에서는 PVC(PersistentVolumeClaim) 사용 권장

---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: ticketing
spec:
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
```

### 3.2 적용하기

```bash
kubectl apply -f postgres.yaml
```

---

## 4. RabbitMQ 배포 (Message Queue)

서비스 간 비동기 메시징을 처리할 RabbitMQ를 배포합니다. **Management Plugin**이 포함된 이미지를 사용하여 웹 UI로 상태를 확인할 수 있습니다.

### 4.1 `rabbitmq.yaml` 작성

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
        # Management Plugin이 포함된 이미지 사용 (웹 UI 포트 15672)
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

## 5. 설치 확인

모든 인프라 파드가 정상적으로 구동되었는지 확인합니다.

```bash
kubectl get pods -n ticketing
```
**예상 출력:**
```
NAME                        READY   STATUS    RESTARTS   AGE
redis-xxxxx                 1/1     Running   0          2m
postgres-xxxxx              1/1     Running   0          1m
rabbitmq-xxxxx              1/1     Running   0          30s
```

### 5.1 RabbitMQ Management 접속 테스트

```bash
# 포트 포워딩 실행
kubectl port-forward svc/rabbitmq -n ticketing 15672:15672
```

브라우저에서 `http://localhost:15672` 접속.
- **ID**: `guest`
- **PW**: `guest`

로그인 후 Dashboard가 보인다면 RabbitMQ가 정상적으로 설치된 것입니다.

---

## ✅ 체크포인트

- [ ] `ticketing` 네임스페이스가 생성되었다.
- [ ] Redis, PostgreSQL, RabbitMQ 파드가 모두 `Running` 상태이다.
- [ ] RabbitMQ Management UI (http://localhost:15672)에 접속할 수 있다.

---

[← 02. 애플리케이션 빌드 및 이미지 준비](./02-build-images.md) | [목차](./README.md) | [04. 애플리케이션 통합 배포 →](./04-app-deploy.md)
