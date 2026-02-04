# LocalStack 사용 가이드

LocalStack은 AWS 서비스를 로컬 환경에서 에뮬레이트하는 도구입니다. 이 프로젝트에서는 SQS를 로컬에서 테스트하기 위해 사용합니다.

## 설치 및 실행

### 1. Docker Compose로 시작

```bash
# LocalStack 포함 전체 서비스 시작
docker-compose up -d

# LocalStack만 시작
docker-compose up -d localstack
```

### 2. LocalStack 상태 확인

```bash
# 헬스 체크
curl http://localhost:4566/_localstack/health

# 또는 브라우저에서
# http://localhost:4566/_localstack/health
```

### 3. SQS 큐 초기화

**Linux/Mac:**
```bash
chmod +x scripts/init-localstack.sh
./scripts/init-localstack.sh
```

**Windows (PowerShell):**
```powershell
.\scripts\init-localstack.ps1
```

## AWS CLI 사용법

### 기본 설정

LocalStack을 사용할 때는 항상 `--endpoint-url`을 지정해야 합니다:

```bash
aws --endpoint-url=http://localhost:4566 \
    --region=us-east-1 \
    sqs list-queues
```

### 자주 사용하는 명령어

#### 큐 목록 조회
```bash
aws --endpoint-url=http://localhost:4566 sqs list-queues
```

#### 큐 생성
```bash
aws --endpoint-url=http://localhost:4566 sqs create-queue \
  --queue-name my-queue \
  --attributes VisibilityTimeout=30
```

#### 메시지 전송
```bash
aws --endpoint-url=http://localhost:4566 sqs send-message \
  --queue-url http://localhost:4566/000000000000/ticket-issue-queue \
  --message-body '{"userId":"test-user","eventId":"event-1"}'
```

#### 메시지 수신
```bash
aws --endpoint-url=http://localhost:4566 sqs receive-message \
  --queue-url http://localhost:4566/000000000000/ticket-issue-queue \
  --max-number-of-messages 10
```

#### 큐 삭제
```bash
aws --endpoint-url=http://localhost:4566 sqs delete-queue \
  --queue-url http://localhost:4566/000000000000/my-queue
```

## Node.js 코드에서 사용

### 환경 변수 설정

**.env (로컬 개발)**
```env
# LocalStack SQS
QUEUE_PROVIDER=sqs
AWS_ENDPOINT=http://localhost:4566
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

**.env (AWS 프로덕션)**
```env
# Real AWS SQS
QUEUE_PROVIDER=sqs
AWS_REGION=ap-northeast-2
# AWS_ENDPOINT는 설정하지 않음 (실제 AWS 사용)
# IAM Role 사용 (키 불필요)
```

### SQS 클라이언트 초기화

```typescript
import { SQSClient } from '@aws-sdk/client-sqs';

// LocalStack 감지
const isLocalStack = !!process.env.AWS_ENDPOINT;

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.AWS_ENDPOINT, // LocalStack: http://localhost:4566
  credentials: isLocalStack ? {
    accessKeyId: 'test',
    secretAccessKey: 'test'
  } : undefined // AWS에서는 IAM Role 사용
});
```

### 메시지 전송

```typescript
import { SendMessageCommand } from '@aws-sdk/client-sqs';

const queueUrl = isLocalStack
  ? 'http://localhost:4566/000000000000/ticket-issue-queue'
  : process.env.SQS_QUEUE_URL;

await sqsClient.send(new SendMessageCommand({
  QueueUrl: queueUrl,
  MessageBody: JSON.stringify({
    userId: 'user-123',
    eventId: 'event-1',
    timestamp: Date.now()
  })
}));
```

### 메시지 수신

```typescript
import { ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

// Long polling
const response = await sqsClient.send(new ReceiveMessageCommand({
  QueueUrl: queueUrl,
  MaxNumberOfMessages: 10,
  WaitTimeSeconds: 20 // Long polling
}));

if (response.Messages) {
  for (const message of response.Messages) {
    const body = JSON.parse(message.Body!);
    
    // 메시지 처리
    await processTicketIssue(body);
    
    // 메시지 삭제
    await sqsClient.send(new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: message.ReceiptHandle
    }));
  }
}
```

## 트러블슈팅

### LocalStack이 시작되지 않음

```bash
# 로그 확인
docker logs ticketing-localstack

# 재시작
docker-compose restart localstack
```

### 큐가 생성되지 않음

```bash
# LocalStack 헬스 체크
curl http://localhost:4566/_localstack/health

# SQS 서비스 상태 확인
# "sqs": "available" 확인
```

### AWS CLI 명령어 실패

```bash
# AWS CLI 버전 확인 (v2 필요)
aws --version

# 자격증명 확인 (LocalStack은 더미 값 사용)
aws configure list
```

### 메시지가 수신되지 않음

```bash
# 큐에 메시지가 있는지 확인
aws --endpoint-url=http://localhost:4566 sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/ticket-issue-queue \
  --attribute-names ApproximateNumberOfMessages

# Visibility Timeout 확인
# 메시지가 처리 중이면 다른 컨슈머가 받을 수 없음
```

## 테스트

### 통합 테스트 예시

```typescript
describe('SQS Integration with LocalStack', () => {
  let sqsClient: SQSClient;
  const queueUrl = 'http://localhost:4566/000000000000/test-queue';
  
  beforeAll(async () => {
    sqsClient = new SQSClient({
      region: 'us-east-1',
      endpoint: 'http://localhost:4566',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
      }
    });
    
    // 테스트 큐 생성
    await sqsClient.send(new CreateQueueCommand({
      QueueName: 'test-queue'
    }));
  });
  
  afterAll(async () => {
    // 테스트 큐 삭제
    await sqsClient.send(new DeleteQueueCommand({
      QueueUrl: queueUrl
    }));
  });
  
  it('should send and receive message', async () => {
    // 메시지 전송
    await sqsClient.send(new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ test: 'data' })
    }));
    
    // 메시지 수신
    const response = await sqsClient.send(new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1
    }));
    
    expect(response.Messages).toHaveLength(1);
    expect(JSON.parse(response.Messages![0].Body!)).toEqual({ test: 'data' });
  });
});
```

## 참고 자료

- [LocalStack 공식 문서](https://docs.localstack.cloud/)
- [AWS SQS 개발자 가이드](https://docs.aws.amazon.com/sqs/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)

## 다음 단계

1. LocalStack 시작: `docker-compose up -d localstack`
2. 큐 초기화: `./scripts/init-localstack.sh`
3. Queue Service 구현 시작 (Task 6)
