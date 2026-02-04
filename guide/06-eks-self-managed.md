# EKS 자체 운영 가이드

[← 05. 아키텍처 비교](./05-comparison.md) | [00. 아키텍처 원칙 →](./00-architecture-principles.md)

---

AWS 관리형 서비스 대신 EKS에서 Redis, RabbitMQ, Kafka를 직접 운영하는 방법을 다룹니다.

## 관리형 vs 자체 운영 비교

### 특성 비교 (5점 만점)

![Managed vs Self-Managed Radar Chart](images/managed-vs-selfmanaged-radar-chart.png)

| 평가 항목 | ElastiCache | Redis-EKS | AmazonMQ | RabbitMQ-EKS | MSK | Kafka-EKS |
|-----------|:-----------:|:---------:|:--------:|:------------:|:---:|:---------:|
| **초기 설정** | ⭐⭐⭐⭐⭐ (5) | ⭐⭐ (2) | ⭐⭐⭐⭐⭐ (5) | ⭐⭐ (2) | ⭐⭐⭐⭐⭐ (5) | ⭐⭐ (2) |
| **운영 편의성** | ⭐⭐⭐⭐⭐ (5) | ⭐⭐ (2) | ⭐⭐⭐⭐ (4) | ⭐⭐ (2) | ⭐⭐⭐⭐ (4) | ⭐⭐ (2) |
| **비용 효율성** | ⭐⭐ (2) | ⭐⭐⭐⭐ (4) | ⭐⭐ (2) | ⭐⭐⭐⭐ (4) | ⭐⭐ (2) | ⭐⭐⭐⭐ (4) |
| **커스터마이징** | ⭐⭐ (2) | ⭐⭐⭐⭐⭐ (5) | ⭐⭐⭐ (3) | ⭐⭐⭐⭐⭐ (5) | ⭐⭐ (2) | ⭐⭐⭐⭐⭐ (5) |
| **고가용성** | ⭐⭐⭐⭐⭐ (5) | ⭐⭐⭐ (3) | ⭐⭐⭐⭐ (4) | ⭐⭐⭐ (3) | ⭐⭐⭐⭐⭐ (5) | ⭐⭐⭐ (3) |
| **확장 용이성** | ⭐⭐⭐⭐⭐ (5) | ⭐⭐⭐ (3) | ⭐⭐⭐ (3) | ⭐⭐⭐ (3) | ⭐⭐⭐⭐ (4) | ⭐⭐⭐ (3) |
| **모니터링** | ⭐⭐⭐⭐⭐ (5) | ⭐⭐⭐ (3) | ⭐⭐⭐⭐ (4) | ⭐⭐⭐ (3) | ⭐⭐⭐⭐⭐ (5) | ⭐⭐⭐ (3) |
| **기술 지원** | ⭐⭐⭐⭐⭐ (5) | ⭐⭐ (2) | ⭐⭐⭐⭐⭐ (5) | ⭐⭐ (2) | ⭐⭐⭐⭐⭐ (5) | ⭐⭐ (2) |
| **총점** | **34/40** | **24/40** | **30/40** | **24/40** | **32/40** | **24/40** |

---

| 운영 방식 | 강점 | 약점 |
|----------|------|------|
| **관리형 (ElastiCache/MQ/MSK)** | 운영 부담 최소, 자동 HA, AWS 지원 | 비용 높음, 커스터마이징 제한 |
| **EKS 자체 운영** | 비용 절감, 완전한 제어, 최신 버전 | 운영 부담, 직접 장애 대응 |

---

### 한눈에 보는 비교

| 항목 | AWS 관리형 | EKS 자체 운영 |
|------|-----------|---------------|
| **초기 설정** | 콘솔 클릭 몇 번 | Helm/Operator 설정 필요 |
| **운영 부담** | AWS가 담당 | 직접 모니터링/패치/백업 |
| **비용 구조** | 시간당 과금 (고정) | EC2 노드 비용 (공유 가능) |
| **커스터마이징** | 제한적 | 완전한 제어 |
| **장애 대응** | AWS 지원 | 직접 대응 |
| **스케일링** | 자동/간편 | 수동 설정 필요 |

### 서비스별 상세 비교

#### Redis: ElastiCache vs EKS

| 항목 | ElastiCache | Redis on EKS |
|------|-------------|--------------|
| 월 비용 (r6g.large) | ~$200 | ~$70 (노드 공유 시) |
| 고가용성 | Multi-AZ 자동 | 직접 구성 필요 |
| 백업 | 자동 스냅샷 | 수동 또는 Operator |
| 버전 업그레이드 | 콘솔에서 클릭 | Rolling Update 직접 |
| 모니터링 | CloudWatch 통합 | Prometheus 구성 필요 |
| 클러스터 모드 | 지원 | 직접 구성 |

#### RabbitMQ: Amazon MQ vs EKS

| 항목 | Amazon MQ | RabbitMQ on EKS |
|------|-----------|-----------------|
| 월 비용 (mq.m5.large) | ~$150 | ~$50 (노드 공유 시) |
| 고가용성 | Active/Standby | 미러링 직접 구성 |
| 플러그인 | 제한적 | 자유롭게 설치 |
| 버전 | AWS 지원 버전만 | 최신 버전 사용 가능 |
| 관리 UI | 기본 제공 | 직접 노출 설정 |

#### Kafka: MSK vs EKS

| 항목 | MSK | Kafka on EKS |
|------|-----|--------------|
| 월 비용 (3 broker) | ~$500+ | ~$200 (노드 공유 시) |
| Zookeeper 관리 | AWS 담당 | 직접 또는 KRaft |
| 버전 업그레이드 | 제한적 | 자유롭게 선택 |
| 커넥터 | MSK Connect | 직접 배포 |
| 스키마 레지스트리 | Glue 연동 | Confluent/Apicurio |

---

## 배포 방법 비교

### 1. Helm Chart (권장 - 빠른 시작)

가장 빠르게 시작할 수 있는 방법입니다.

```mermaid
flowchart LR
    subgraph "Helm 배포"
        H[Helm CLI] --> R[Bitnami Redis]
        H --> MQ[Bitnami RabbitMQ]
        H --> K[Bitnami Kafka]
    end
    
    subgraph "EKS Cluster"
        R --> P1[Pod + PVC]
        MQ --> P2[Pod + PVC]
        K --> P3[Pod + PVC]
    end
```

**장점**: 빠른 설치, 검증된 설정, 쉬운 업그레이드
**단점**: 세밀한 커스터마이징 제한

### 2. Operator 패턴 (권장 - 프로덕션)

Kubernetes 네이티브 방식으로 운영 자동화를 제공합니다.

```mermaid
flowchart LR
    subgraph "Operator 배포"
        O1[Redis Operator] --> RC[RedisCluster CR]
        O2[RabbitMQ Operator] --> RMQ[RabbitmqCluster CR]
        O3[Strimzi Operator] --> KC[Kafka CR]
    end
    
    subgraph "자동 관리"
        RC --> |자동 생성| RS[Redis StatefulSet]
        RMQ --> |자동 생성| RMQS[RabbitMQ StatefulSet]
        KC --> |자동 생성| KS[Kafka StatefulSet]
    end
```

**장점**: 자동 페일오버, 선언적 관리, 운영 자동화
**단점**: Operator 학습 필요, 추가 리소스 사용

### 3. StatefulSet 직접 구성 (학습용)

Kubernetes 기본 리소스만 사용합니다.

**장점**: 완전한 제어, 깊은 이해
**단점**: 모든 것을 직접 구현, 운영 부담 큼

---

## Redis on EKS

### Helm으로 설치

```bash
# Bitnami Helm repo 추가
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Redis 클러스터 설치
helm install redis bitnami/redis \
  --namespace redis \
  --create-namespace \
  --set architecture=replication \
  --set replica.replicaCount=2 \
  --set auth.password=your-password \
  --set master.persistence.size=10Gi \
  --set replica.persistence.size=10Gi
```

### Redis Operator로 설치 (프로덕션 권장)

```bash
# Redis Operator 설치
helm repo add ot-helm https://ot-container-kit.github.io/helm-charts/
helm install redis-operator ot-helm/redis-operator --namespace redis-operator --create-namespace
```

```yaml
# redis-cluster.yaml
apiVersion: redis.redis.opstreelabs.in/v1beta2
kind: RedisCluster
metadata:
  name: redis-cluster
  namespace: redis
spec:
  clusterSize: 3
  clusterVersion: v7
  persistenceEnabled: true
  kubernetesConfig:
    image: redis:7.2-alpine
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 500m
        memory: 512Mi
  storage:
    volumeClaimTemplate:
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi
        storageClassName: gp3
  redisExporter:
    enabled: true
    image: quay.io/opstree/redis-exporter:v1.44.0
```

```bash
kubectl apply -f redis-cluster.yaml
```

### 애플리케이션 연결 설정

```typescript
// EKS 내부 Redis 연결
const redisConfig = {
  // Helm 설치 시
  url: 'redis://:your-password@redis-master.redis.svc.cluster.local:6379',
  
  // Operator 클러스터 설치 시
  // url: 'redis://:password@redis-cluster.redis.svc.cluster.local:6379',
};
```

### 고가용성 구성

```yaml
# values-ha.yaml (Helm용)
architecture: replication
replica:
  replicaCount: 2
sentinel:
  enabled: true
  masterSet: mymaster
  quorum: 2
master:
  persistence:
    enabled: true
    size: 10Gi
  affinity:
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        - labelSelector:
            matchLabels:
              app.kubernetes.io/name: redis
          topologyKey: topology.kubernetes.io/zone
```

```bash
helm install redis bitnami/redis -f values-ha.yaml -n redis
```

---

## RabbitMQ on EKS

### Helm으로 설치

```bash
helm install rabbitmq bitnami/rabbitmq \
  --namespace rabbitmq \
  --create-namespace \
  --set replicaCount=3 \
  --set auth.username=admin \
  --set auth.password=your-password \
  --set persistence.size=10Gi \
  --set clustering.enabled=true
```

### RabbitMQ Cluster Operator (프로덕션 권장)

```bash
# Operator 설치
kubectl apply -f https://github.com/rabbitmq/cluster-operator/releases/latest/download/cluster-operator.yml
```

```yaml
# rabbitmq-cluster.yaml
apiVersion: rabbitmq.com/v1beta1
kind: RabbitmqCluster
metadata:
  name: rabbitmq
  namespace: rabbitmq
spec:
  replicas: 3
  image: rabbitmq:3.12-management
  persistence:
    storageClassName: gp3
    storage: 10Gi
  resources:
    requests:
      cpu: 200m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 1Gi
  rabbitmq:
    additionalConfig: |
      cluster_partition_handling = pause_minority
      vm_memory_high_watermark.relative = 0.8
      disk_free_limit.relative = 1.5
  affinity:
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        - labelSelector:
            matchLabels:
              app.kubernetes.io/name: rabbitmq
          topologyKey: topology.kubernetes.io/zone
```

```bash
kubectl apply -f rabbitmq-cluster.yaml
```

### 관리 UI 접근

```bash
# Port Forward로 접근
kubectl port-forward svc/rabbitmq -n rabbitmq 15672:15672

# 또는 Ingress 설정
```

```yaml
# rabbitmq-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: rabbitmq-management
  namespace: rabbitmq
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internal
spec:
  rules:
    - host: rabbitmq.internal.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: rabbitmq
                port:
                  number: 15672
```

### 애플리케이션 연결 설정

```typescript
// EKS 내부 RabbitMQ 연결
const rabbitmqConfig = {
  // Helm 설치 시
  url: 'amqp://admin:your-password@rabbitmq.rabbitmq.svc.cluster.local:5672',
  
  // Operator 설치 시
  // url: 'amqp://default_user:password@rabbitmq.rabbitmq.svc.cluster.local:5672',
};
```

---

## Kafka on EKS

### Strimzi Operator (프로덕션 권장)

Kafka on Kubernetes의 사실상 표준입니다.

```bash
# Strimzi Operator 설치
kubectl create namespace kafka
kubectl apply -f 'https://strimzi.io/install/latest?namespace=kafka' -n kafka
```

```yaml
# kafka-cluster.yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: kafka-cluster
  namespace: kafka
spec:
  kafka:
    version: 3.6.0
    replicas: 3
    listeners:
      - name: plain
        port: 9092
        type: internal
        tls: false
      - name: tls
        port: 9093
        type: internal
        tls: true
    config:
      offsets.topic.replication.factor: 3
      transaction.state.log.replication.factor: 3
      transaction.state.log.min.isr: 2
      default.replication.factor: 3
      min.insync.replicas: 2
      inter.broker.protocol.version: "3.6"
    storage:
      type: jbod
      volumes:
        - id: 0
          type: persistent-claim
          size: 100Gi
          class: gp3
          deleteClaim: false
    resources:
      requests:
        memory: 2Gi
        cpu: 500m
      limits:
        memory: 4Gi
        cpu: 2000m
    template:
      pod:
        affinity:
          podAntiAffinity:
            requiredDuringSchedulingIgnoredDuringExecution:
              - labelSelector:
                  matchLabels:
                    strimzi.io/name: kafka-cluster-kafka
                topologyKey: topology.kubernetes.io/zone
  zookeeper:
    replicas: 3
    storage:
      type: persistent-claim
      size: 10Gi
      class: gp3
    resources:
      requests:
        memory: 512Mi
        cpu: 100m
  entityOperator:
    topicOperator: {}
    userOperator: {}
```

```bash
kubectl apply -f kafka-cluster.yaml
```

### KRaft 모드 (Zookeeper 없이)

Kafka 3.3+ 에서는 Zookeeper 없이 운영 가능합니다.

```yaml
# kafka-kraft.yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaNodePool
metadata:
  name: dual-role
  namespace: kafka
  labels:
    strimzi.io/cluster: kafka-cluster
spec:
  replicas: 3
  roles:
    - controller
    - broker
  storage:
    type: jbod
    volumes:
      - id: 0
        type: persistent-claim
        size: 100Gi
        class: gp3
---
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: kafka-cluster
  namespace: kafka
  annotations:
    strimzi.io/kraft: enabled
    strimzi.io/node-pools: enabled
spec:
  kafka:
    version: 3.6.0
    metadataVersion: 3.6-IV2
    listeners:
      - name: plain
        port: 9092
        type: internal
        tls: false
    config:
      offsets.topic.replication.factor: 3
      transaction.state.log.replication.factor: 3
      transaction.state.log.min.isr: 2
  entityOperator:
    topicOperator: {}
    userOperator: {}
```

### Topic 생성 (선언적)

```yaml
# kafka-topic.yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: ticket-issue
  namespace: kafka
  labels:
    strimzi.io/cluster: kafka-cluster
spec:
  partitions: 6
  replicas: 3
  config:
    retention.ms: 86400000
    min.insync.replicas: 2
```

### Kafka UI 배포

```yaml
# kafka-ui.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kafka-ui
  namespace: kafka
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kafka-ui
  template:
    metadata:
      labels:
        app: kafka-ui
    spec:
      containers:
        - name: kafka-ui
          image: provectuslabs/kafka-ui:latest
          ports:
            - containerPort: 8080
          env:
            - name: KAFKA_CLUSTERS_0_NAME
              value: kafka-cluster
            - name: KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS
              value: kafka-cluster-kafka-bootstrap:9092
---
apiVersion: v1
kind: Service
metadata:
  name: kafka-ui
  namespace: kafka
spec:
  ports:
    - port: 8080
  selector:
    app: kafka-ui
```

### 애플리케이션 연결 설정

```typescript
// EKS 내부 Kafka 연결
const kafkaConfig = {
  brokers: ['kafka-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092'],
  // TLS 사용 시
  // brokers: ['kafka-cluster-kafka-bootstrap.kafka.svc.cluster.local:9093'],
  // ssl: true,
};
```

---

## 스토리지 설정 (EBS CSI Driver)

### EBS CSI Driver 설치

```bash
# IAM 정책 연결 (eksctl 사용 시)
eksctl create iamserviceaccount \
  --name ebs-csi-controller-sa \
  --namespace kube-system \
  --cluster your-cluster \
  --attach-policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy \
  --approve

# EBS CSI Driver 애드온 설치
eksctl create addon \
  --name aws-ebs-csi-driver \
  --cluster your-cluster \
  --service-account-role-arn arn:aws:iam::ACCOUNT_ID:role/AmazonEKS_EBS_CSI_DriverRole
```

### StorageClass 생성

```yaml
# storageclass-gp3.yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
  encrypted: "true"
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
reclaimPolicy: Retain
```

---

## 모니터링 구성

### Prometheus + Grafana 설치

```bash
# kube-prometheus-stack 설치
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace
```

### ServiceMonitor 설정

```yaml
# redis-servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: redis
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: redis
  namespaceSelector:
    matchNames:
      - redis
  endpoints:
    - port: metrics
      interval: 30s
```

### 주요 모니터링 메트릭

| 컴포넌트 | 메트릭 | 알람 임계치 |
|----------|--------|-------------|
| Redis | `redis_memory_used_bytes` | > 80% of max |
| Redis | `redis_connected_clients` | > 1000 |
| RabbitMQ | `rabbitmq_queue_messages` | > 10000 |
| RabbitMQ | `rabbitmq_queue_consumers` | = 0 |
| Kafka | `kafka_consumer_lag` | > 10000 |
| Kafka | `kafka_under_replicated_partitions` | > 0 |

---

## 백업 전략

### Redis 백업

```yaml
# redis-backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: redis-backup
  namespace: redis
spec:
  schedule: "0 2 * * *"  # 매일 02:00
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: redis:7.2-alpine
              command:
                - /bin/sh
                - -c
                - |
                  redis-cli -h redis-master BGSAVE
                  sleep 10
                  aws s3 cp /data/dump.rdb s3://backup-bucket/redis/$(date +%Y%m%d).rdb
              volumeMounts:
                - name: redis-data
                  mountPath: /data
          volumes:
            - name: redis-data
              persistentVolumeClaim:
                claimName: redis-data-redis-master-0
          restartPolicy: OnFailure
```

### Kafka 백업 (MirrorMaker2)

```yaml
# kafka-mirror.yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaMirrorMaker2
metadata:
  name: kafka-backup
  namespace: kafka
spec:
  version: 3.6.0
  replicas: 1
  connectCluster: backup
  clusters:
    - alias: source
      bootstrapServers: kafka-cluster-kafka-bootstrap:9092
    - alias: backup
      bootstrapServers: backup-kafka-bootstrap:9092
  mirrors:
    - sourceCluster: source
      targetCluster: backup
      sourceConnector:
        config:
          replication.factor: 3
      topicsPattern: ".*"
```

---

## 언제 자체 운영을 선택해야 하는가?

### ✅ 자체 운영이 적합한 경우

| 상황 | 이유 |
|------|------|
| **대규모 트래픽** | 관리형 비용이 월 $1,000+ 초과 시 |
| **세밀한 튜닝** | 관리형에서 지원하지 않는 설정 필요 |
| **최신 버전** | 관리형보다 빠른 버전 업그레이드 필요 |
| **멀티클라우드** | AWS 외 다른 클라우드에서도 동일 구성 |
| **학습 목적** | 내부 동작 원리 이해 필요 |

### ❌ 관리형이 더 나은 경우

| 상황 | 이유 |
|------|------|
| **소규모 팀** | 운영 인력 부족 |
| **빠른 출시** | 인프라보다 비즈니스 로직에 집중 |
| **SLA 요구** | AWS 지원 및 보장 필요 |
| **규정 준수** | 관리형 서비스의 인증 활용 |

### 비용 손익분기점 (예시)

```
월 비용 비교 (Redis 기준)

ElastiCache r6g.large:     ~$200/월
EKS 자체 운영:
  - 노드 비용 (공유):      ~$50/월
  - 운영 인력 (시간당):    ~$50/월 (월 1시간 가정)
  - 총:                    ~$100/월

→ 단순 비용만 보면 자체 운영이 저렴
→ 하지만 장애 대응, 업그레이드 시간 고려 필요
→ 월 $500+ 규모부터 자체 운영 검토 권장
```

---

## ⚠️ 자체 운영 시 주의사항

### 1. Pod Anti-Affinity 필수

```yaml
# 같은 노드/AZ에 배치되지 않도록
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels:
            app: redis
        topologyKey: topology.kubernetes.io/zone
```

### 2. PodDisruptionBudget 설정

```yaml
# 최소 가용 Pod 보장
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: redis-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: redis
```

### 3. Resource Limits 설정

```yaml
resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 2000m
    memory: 2Gi  # OOM 방지
```

### 4. Liveness/Readiness Probe

```yaml
livenessProbe:
  exec:
    command: ["redis-cli", "ping"]
  initialDelaySeconds: 30
  periodSeconds: 10
readinessProbe:
  exec:
    command: ["redis-cli", "ping"]
  initialDelaySeconds: 5
  periodSeconds: 5
```

---

## 운영 체크리스트

| 항목 | 확인 |
|------|------|
| EBS CSI Driver 설치 | ☐ |
| StorageClass (gp3) 생성 | ☐ |
| Pod Anti-Affinity 설정 | ☐ |
| PodDisruptionBudget 설정 | ☐ |
| Resource Limits 설정 | ☐ |
| Prometheus 모니터링 | ☐ |
| 알람 설정 (Slack/PagerDuty) | ☐ |
| 백업 CronJob 설정 | ☐ |
| 복구 테스트 완료 | ☐ |
| 장애 대응 런북 작성 | ☐ |

---

[← 05. 아키텍처 비교](./05-comparison.md) | [00. 아키텍처 원칙 →](./00-architecture-principles.md)
