#!/bin/bash
# Initialize ticket events in Redis

EVENTS='{"bts-concert":{"name":"BTS 월드투어 서울 콘서트","capacity":1,"processingRate":1},"lim-younghung":{"name":"임영웅 전국투어 콘서트","capacity":1,"processingRate":1}}'

docker exec ticketing-redis redis-cli HSET "queue:config" ticketEvents "$EVENTS"
