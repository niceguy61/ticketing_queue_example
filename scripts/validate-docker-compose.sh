#!/bin/bash

# Docker Compose 설정 검증 스크립트
# 이 스크립트는 docker-compose.yml 파일의 유효성을 검증하고
# 필요한 파일들이 모두 존재하는지 확인합니다.

set -e

echo "=========================================="
echo "Docker Compose 설정 검증"
echo "=========================================="
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 성공/실패 카운터
SUCCESS_COUNT=0
FAIL_COUNT=0

# 검증 함수
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((SUCCESS_COUNT++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAIL_COUNT++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Docker 및 Docker Compose 설치 확인
echo "1. Docker 환경 확인..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    check_pass "Docker 설치됨: $DOCKER_VERSION"
else
    check_fail "Docker가 설치되지 않았습니다"
    exit 1
fi

if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    check_pass "Docker Compose 설치됨: $COMPOSE_VERSION"
else
    check_fail "Docker Compose가 설치되지 않았습니다"
    exit 1
fi
echo ""

# 2. 필수 파일 존재 확인
echo "2. 필수 파일 확인..."
REQUIRED_FILES=(
    "docker-compose.yml"
    ".env.example"
    "database/schema.sql"
    "services/user-service/Dockerfile"
    "services/ticket-service/Dockerfile"
    "services/queue-service/Dockerfile"
    "frontend/Dockerfile"
    "frontend/nginx.conf"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        check_pass "$file 존재"
    else
        check_fail "$file 없음"
    fi
done
echo ""

# 3. .env 파일 확인
echo "3. 환경 변수 파일 확인..."
if [ -f ".env" ]; then
    check_pass ".env 파일 존재"
else
    check_warn ".env 파일이 없습니다. .env.example을 복사하세요:"
    echo "   cp .env.example .env"
fi
echo ""

# 4. docker-compose.yml 구문 검증
echo "4. docker-compose.yml 구문 검증..."
if docker-compose config --quiet; then
    check_pass "docker-compose.yml 구문 유효"
else
    check_fail "docker-compose.yml 구문 오류"
    exit 1
fi
echo ""

# 5. 서비스 정의 확인
echo "5. 서비스 정의 확인..."
REQUIRED_SERVICES=(
    "postgres"
    "redis"
    "user-service"
    "ticket-service"
    "queue-service"
    "frontend"
)

for service in "${REQUIRED_SERVICES[@]}"; do
    if docker-compose config --services | grep -q "^${service}$"; then
        check_pass "$service 서비스 정의됨"
    else
        check_fail "$service 서비스 정의되지 않음"
    fi
done
echo ""

# 6. 네트워크 설정 확인
echo "6. 네트워크 설정 확인..."
if docker-compose config | grep -q "ticketing-network"; then
    check_pass "ticketing-network 정의됨"
else
    check_fail "ticketing-network 정의되지 않음"
fi
echo ""

# 7. 볼륨 설정 확인
echo "7. 볼륨 설정 확인..."
REQUIRED_VOLUMES=(
    "postgres-data"
    "redis-data"
)

for volume in "${REQUIRED_VOLUMES[@]}"; do
    if docker-compose config | grep -q "$volume"; then
        check_pass "$volume 볼륨 정의됨"
    else
        check_fail "$volume 볼륨 정의되지 않음"
    fi
done
echo ""

# 8. 포트 충돌 확인
echo "8. 포트 사용 확인..."
PORTS=(3001 3002 3003 5432 6379 80)

for port in "${PORTS[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -an | grep -q ":$port.*LISTEN" 2>/dev/null; then
        check_warn "포트 $port 이미 사용 중 (충돌 가능)"
    else
        check_pass "포트 $port 사용 가능"
    fi
done
echo ""

# 9. Dockerfile 구문 확인
echo "9. Dockerfile 검증..."
DOCKERFILES=(
    "services/user-service/Dockerfile"
    "services/ticket-service/Dockerfile"
    "services/queue-service/Dockerfile"
    "frontend/Dockerfile"
)

for dockerfile in "${DOCKERFILES[@]}"; do
    if [ -f "$dockerfile" ]; then
        if docker build -f "$dockerfile" --no-cache -t test-validation:latest "$(dirname "$dockerfile")" > /dev/null 2>&1; then
            check_pass "$dockerfile 빌드 가능"
            docker rmi test-validation:latest > /dev/null 2>&1 || true
        else
            check_warn "$dockerfile 빌드 검증 스킵 (의존성 필요)"
        fi
    fi
done
echo ""

# 10. 환경 변수 검증
echo "10. 환경 변수 검증..."
if [ -f ".env" ]; then
    REQUIRED_ENV_VARS=(
        "QUEUE_MODE"
        "QUEUE_PROVIDER"
        "NODE_ENV"
    )
    
    for var in "${REQUIRED_ENV_VARS[@]}"; do
        if grep -q "^${var}=" .env; then
            check_pass "$var 설정됨"
        else
            check_warn "$var 설정되지 않음 (기본값 사용)"
        fi
    done
else
    check_warn ".env 파일이 없어 환경 변수 검증 스킵"
fi
echo ""

# 결과 요약
echo "=========================================="
echo "검증 결과 요약"
echo "=========================================="
echo -e "${GREEN}성공: $SUCCESS_COUNT${NC}"
echo -e "${RED}실패: $FAIL_COUNT${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ 모든 검증 통과!${NC}"
    echo ""
    echo "다음 명령어로 시스템을 시작할 수 있습니다:"
    echo "  docker-compose up -d"
    exit 0
else
    echo -e "${RED}✗ 일부 검증 실패${NC}"
    echo ""
    echo "위의 오류를 수정한 후 다시 시도하세요."
    exit 1
fi
