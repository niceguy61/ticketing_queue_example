#!/bin/bash

# LocalStack 초기화 스크립트
# SQS 큐 생성 및 설정

set -e

ENDPOINT_URL="http://localhost:4566"
REGION="us-east-1"

echo "Waiting for LocalStack to be ready..."
until curl -s "${ENDPOINT_URL}/_localstack/health" | grep -q '"sqs": "available"'; do
  echo "Waiting for SQS service..."
  sleep 2
done

echo "LocalStack is ready!"

# SQS 큐 생성
echo "Creating SQS queues..."

# 티켓 발급 큐
aws --endpoint-url="${ENDPOINT_URL}" \
    --region="${REGION}" \
    sqs create-queue \
    --queue-name ticket-issue-queue \
    --attributes VisibilityTimeout=30,MessageRetentionPeriod=86400

# 대기열 이벤트 큐
aws --endpoint-url="${ENDPOINT_URL}" \
    --region="${REGION}" \
    sqs create-queue \
    --queue-name queue-events \
    --attributes VisibilityTimeout=30,MessageRetentionPeriod=86400

# Dead Letter Queue
aws --endpoint-url="${ENDPOINT_URL}" \
    --region="${REGION}" \
    sqs create-queue \
    --queue-name ticket-issue-dlq \
    --attributes MessageRetentionPeriod=1209600

echo "SQS queues created successfully!"

# 큐 목록 확인
echo "Available queues:"
aws --endpoint-url="${ENDPOINT_URL}" \
    --region="${REGION}" \
    sqs list-queues

echo "LocalStack initialization complete!"
