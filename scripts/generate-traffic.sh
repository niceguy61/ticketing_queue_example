#!/bin/bash
# 트래픽 생성 스크립트
# 사용자 등록 후 대기열 진입 시나리오

USER_SERVICE="http://localhost:3003"
QUEUE_SERVICE="http://localhost:3001"
COUNT=${1:-10}

echo "Generating traffic for $COUNT users..."

for i in $(seq 1 $COUNT); do
  # 사용자 등록
  RESPONSE=$(curl -s -X POST "$USER_SERVICE/api/users/register" \
    -H "Content-Type: application/json" \
    -d '{"username": "testuser-'"$i"'", "email": "testuser-'"$i"'@example.com"}')

  USER_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('userId',''))" 2>/dev/null)

  if [ -z "$USER_ID" ]; then
    echo "[$i] Failed to register: $RESPONSE"
    continue
  fi

  # 대기열 진입
  QUEUE_RESPONSE=$(curl -s -X POST "$QUEUE_SERVICE/api/queue/lobby/join" \
    -H "Content-Type: application/json" \
    -d '{"userId": "'"$USER_ID"'"}')

  echo "[$i] User $USER_ID joined - $QUEUE_RESPONSE"
  sleep 1
done

echo "Done!"
