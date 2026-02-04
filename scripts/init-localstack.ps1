# LocalStack 초기화 스크립트 (PowerShell)
# SQS 큐 생성 및 설정

$ErrorActionPreference = "Stop"

$ENDPOINT_URL = "http://localhost:4566"
$REGION = "us-east-1"

Write-Host "Waiting for LocalStack to be ready..." -ForegroundColor Yellow

# LocalStack 준비 대기
$maxAttempts = 30
$attempt = 0
$ready = $false

while (-not $ready -and $attempt -lt $maxAttempts) {
    try {
        $response = Invoke-RestMethod -Uri "$ENDPOINT_URL/_localstack/health" -Method Get
        if ($response.services.sqs -eq "available") {
            $ready = $true
            Write-Host "LocalStack is ready!" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "Waiting for SQS service..." -ForegroundColor Gray
        Start-Sleep -Seconds 2
        $attempt++
    }
}

if (-not $ready) {
    Write-Host "LocalStack failed to start" -ForegroundColor Red
    exit 1
}

# SQS 큐 생성
Write-Host "Creating SQS queues..." -ForegroundColor Yellow

# 티켓 발급 큐
aws --endpoint-url=$ENDPOINT_URL `
    --region=$REGION `
    sqs create-queue `
    --queue-name ticket-issue-queue `
    --attributes VisibilityTimeout=30,MessageRetentionPeriod=86400

Write-Host "Created: ticket-issue-queue" -ForegroundColor Green

# 대기열 이벤트 큐
aws --endpoint-url=$ENDPOINT_URL `
    --region=$REGION `
    sqs create-queue `
    --queue-name queue-events `
    --attributes VisibilityTimeout=30,MessageRetentionPeriod=86400

Write-Host "Created: queue-events" -ForegroundColor Green

# Dead Letter Queue
aws --endpoint-url=$ENDPOINT_URL `
    --region=$REGION `
    sqs create-queue `
    --queue-name ticket-issue-dlq `
    --attributes MessageRetentionPeriod=1209600

Write-Host "Created: ticket-issue-dlq" -ForegroundColor Green

# 큐 목록 확인
Write-Host "`nAvailable queues:" -ForegroundColor Yellow
aws --endpoint-url=$ENDPOINT_URL `
    --region=$REGION `
    sqs list-queues

Write-Host "`nLocalStack initialization complete!" -ForegroundColor Green
