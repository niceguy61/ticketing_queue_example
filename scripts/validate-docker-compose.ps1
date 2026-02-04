# Docker Compose Validation Script for Windows PowerShell
# This script validates the docker-compose.yml configuration

Write-Host "=== Docker Compose Validation Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if docker-compose is installed
Write-Host "Checking Docker Compose installation..." -ForegroundColor Yellow
$dockerComposeVersion = docker-compose --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: docker-compose is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Docker Desktop for Windows" -ForegroundColor Red
    exit 1
}
Write-Host "Found: $dockerComposeVersion" -ForegroundColor Green
Write-Host ""

# Check if Docker daemon is running
Write-Host "Checking Docker daemon..." -ForegroundColor Yellow
$dockerInfo = docker info 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker daemon is not running" -ForegroundColor Red
    Write-Host "Please start Docker Desktop" -ForegroundColor Red
    exit 1
}
Write-Host "Docker daemon is running" -ForegroundColor Green
Write-Host ""

# Validate docker-compose.yml syntax
Write-Host "Validating docker-compose.yml syntax..." -ForegroundColor Yellow
$configOutput = docker-compose config --quiet 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: docker-compose.yml has syntax errors:" -ForegroundColor Red
    Write-Host $configOutput -ForegroundColor Red
    exit 1
}
Write-Host "Syntax validation passed" -ForegroundColor Green
Write-Host ""

# Check if .env file exists
Write-Host "Checking environment configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "Found .env file" -ForegroundColor Green
} else {
    Write-Host "WARNING: .env file not found" -ForegroundColor Yellow
    Write-Host "Copy .env.example to .env and configure it:" -ForegroundColor Yellow
    Write-Host "  copy .env.example .env" -ForegroundColor Cyan
}
Write-Host ""

# List services
Write-Host "Services defined in docker-compose.yml:" -ForegroundColor Yellow
$services = docker-compose config --services
foreach ($service in $services) {
    Write-Host "  - $service" -ForegroundColor Cyan
}
Write-Host ""

# Check for required ports
Write-Host "Checking port availability..." -ForegroundColor Yellow
$portsToCheck = @(
    @{Port=5432; Service="PostgreSQL"},
    @{Port=6379; Service="Redis"},
    @{Port=3001; Service="User Service"},
    @{Port=3002; Service="Ticket Service"},
    @{Port=3003; Service="Queue Service"},
    @{Port=3000; Service="Frontend"}
)

$portsInUse = @()
foreach ($portInfo in $portsToCheck) {
    $port = $portInfo.Port
    $service = $portInfo.Service
    
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connection) {
        Write-Host "  WARNING: Port $port ($service) is already in use" -ForegroundColor Yellow
        $portsInUse += $port
    } else {
        Write-Host "  Port $port ($service) is available" -ForegroundColor Green
    }
}
Write-Host ""

# Summary
Write-Host "=== Validation Summary ===" -ForegroundColor Cyan
if ($portsInUse.Count -eq 0) {
    Write-Host "All checks passed! Ready to start services." -ForegroundColor Green
    Write-Host ""
    Write-Host "To start all services:" -ForegroundColor Yellow
    Write-Host "  docker-compose up -d" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To start with optional services (RabbitMQ, LocalStack):" -ForegroundColor Yellow
    Write-Host "  docker-compose --profile rabbitmq --profile localstack up -d" -ForegroundColor Cyan
} else {
    Write-Host "Validation completed with warnings" -ForegroundColor Yellow
    Write-Host "Ports in use: $($portsInUse -join ', ')" -ForegroundColor Yellow
    Write-Host "Stop services using these ports or modify docker-compose.yml" -ForegroundColor Yellow
}
Write-Host ""
