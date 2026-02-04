import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { QueueMode, QueueStatus, Ticket } from '../types';
import { config } from '../config';

interface UseQueueOptions {
  userId: string;
  mode: QueueMode;
  eventId?: string;
}

interface UseQueueReturn {
  socket: Socket | null;
  isConnected: boolean;
  isJoined: boolean;
  position: number | null;
  status: QueueStatus | null;
  ticket: Ticket | null;
  error: string | null;
  joinQueue: () => Promise<boolean>;
  leaveQueue: () => void;
}

/**
 * Socket.io 연결 및 대기열 상태 관리를 위한 커스텀 훅
 * @param options 사용자 ID, 모드, 이벤트 ID
 * @returns Socket 연결 상태 및 대기열 정보
 */
export const useQueue = ({ userId, mode, eventId }: UseQueueOptions): UseQueueReturn => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = config.socketReconnectionAttempts;
  const joinResolveRef = useRef<((value: boolean) => void) | null>(null);

  useEffect(() => {
    // Socket.io 연결 생성
    const newSocket = io(config.queueServiceUrl, {
      reconnection: true,
      reconnectionDelay: config.socketReconnectionDelay,
      reconnectionAttempts: maxReconnectAttempts,
      transports: ['websocket', 'polling'],
    });

    // 연결 성공
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
    });

    // 연결 해제
    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      
      if (reason === 'io server disconnect') {
        // 서버가 연결을 끊음 - 수동 재연결 필요
        newSocket.connect();
      }
    });

    // 연결 에러
    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      reconnectAttemptsRef.current += 1;
      
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
      }
    });

    // 재연결 시도
    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log('Reconnection attempt:', attemptNumber);
    });

    // 재연결 성공
    newSocket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      setError(null);
      reconnectAttemptsRef.current = 0;
    });

    // room join 완료 확인
    newSocket.on('queue:joined', (data: { userId: string; success: boolean }) => {
      console.log('Queue joined confirmed:', data);
      setIsJoined(true);
      if (joinResolveRef.current) {
        joinResolveRef.current(data.success);
        joinResolveRef.current = null;
      }
    });

    // 대기열 위치 업데이트
    newSocket.on('queue:position-update', (data: { position: number; estimatedWaitTime: number }) => {
      console.log('Position update:', data);
      setPosition(data.position);
    });

    // 대기열 상태 업데이트
    newSocket.on('queue:status-update', (data: QueueStatus) => {
      console.log('Status update:', data);
      setStatus(data);
    });

    // 차례 도착 (티켓 발급 또는 이벤트 선택)
    newSocket.on('queue:your-turn', (data: { ticket?: Ticket; message?: string }) => {
      console.log('Your turn!', data);
      if (data.ticket) {
        // Simple 모드 또는 티켓 대기열: 티켓 발급됨
        setTicket(data.ticket);
      } else {
        // Advanced 모드 로비 대기열: 이벤트 선택으로 이동 (ticket을 null로 설정하지 않음)
        // isYourTurn 상태를 추가하여 프론트엔드에서 처리
        setTicket({ isYourTurn: true } as any);
      }
      setPosition(null);
    });

    // 에러 이벤트
    newSocket.on('error', (data: { message: string; code?: string }) => {
      console.error('Queue error:', data);
      setError(data.message);
    });

    setSocket(newSocket);

    // 클린업
    return () => {
      console.log('Cleaning up socket connection');
      newSocket.close();
    };
  }, [userId, mode, eventId, maxReconnectAttempts]);

  // 대기열 진입 (Promise 반환 - room join 완료 대기)
  const joinQueue = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!socket || !isConnected) {
        setError('서버에 연결되지 않았습니다.');
        resolve(false);
        return;
      }

      console.log('Joining queue:', { userId, mode, eventId });
      
      // resolve 함수 저장 (queue:joined 이벤트에서 호출)
      joinResolveRef.current = resolve;
      
      // 타임아웃 설정 (3초 후 자동 resolve)
      setTimeout(() => {
        if (joinResolveRef.current) {
          console.log('Join queue timeout, proceeding anyway');
          joinResolveRef.current(true);
          joinResolveRef.current = null;
          setIsJoined(true);
        }
      }, 3000);
      
      socket.emit('queue:join', { userId, mode, eventId });
    });
  }, [socket, isConnected, userId, mode, eventId]);

  // 대기열 이탈
  const leaveQueue = useCallback(() => {
    if (!socket || !isConnected) {
      return;
    }

    console.log('Leaving queue:', { userId });
    socket.emit('queue:leave', { userId });
    setPosition(null);
    setTicket(null);
    setIsJoined(false);
  }, [socket, isConnected, userId]);

  return {
    socket,
    isConnected,
    isJoined,
    position,
    status,
    ticket,
    error,
    joinQueue,
    leaveQueue,
  };
};
