import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueue } from '../hooks/useQueue';
import { joinTicketQueue, getEvents } from '../api/queueService';
import { Event } from '../types';
import QueueStatus from '../components/QueueStatus';
import ErrorMessage from '../components/ErrorMessage';
import SuccessMessage from '../components/SuccessMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import './TicketQueue.css';

/**
 * 티켓 대기열 화면 (Advanced 모드)
 * 선택한 이벤트의 티켓 대기열에서 대기합니다.
 */
const TicketQueue: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [inQueue, setInQueue] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Socket.io 연결 및 대기열 상태 관리
  const {
    isConnected,
    isJoined,
    position,
    status,
    ticket,
    error: socketError,
    joinQueue: joinQueueSocket,
    leaveQueue: leaveQueueSocket,
  } = useQueue({
    userId: userId || '',
    mode: 'ticket',
    eventId: eventId,
  });

  // 초기화: 로컬 스토리지에서 사용자 정보 로드
  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    const storedUsername = localStorage.getItem('username');

    if (!storedUserId) {
      // 사용자 정보가 없으면 등록 화면으로 이동
      navigate('/register');
      return;
    }

    setUserId(storedUserId);
    setUsername(storedUsername);
  }, [navigate]);

  // 이벤트 정보 로드
  useEffect(() => {
    if (!userId || !eventId) {
      return;
    }

    loadEventInfo();
  }, [userId, eventId]);

  // 티켓 발급 완료 시 티켓 화면으로 이동
  useEffect(() => {
    if (ticket) {
      setSuccessMessage('티켓이 발급되었습니다!');
      setTimeout(() => {
        navigate(`/ticket/${ticket.ticketId}`);
      }, 2000);
    }
  }, [ticket, navigate]);

  // Socket 에러 처리
  useEffect(() => {
    if (socketError) {
      setError(socketError);
    }
  }, [socketError]);

  /**
   * 이벤트 정보 로드
   */
  const loadEventInfo = async () => {
    if (!eventId) {
      return;
    }

    try {
      const response = await getEvents();
      const foundEvent = response.events.find((e) => e.eventId === eventId);

      if (!foundEvent) {
        setError('이벤트를 찾을 수 없습니다.');
        return;
      }

      setEvent(foundEvent);
    } catch (err: any) {
      console.error('Failed to load event info:', err);
      setError(err.message || '이벤트 정보를 불러오는데 실패했습니다.');
    }
  };

  /**
   * 티켓 대기열 진입 처리
   */
  const handleJoinQueue = async () => {
    if (!userId || !eventId) {
      setError('사용자 또는 이벤트 정보를 찾을 수 없습니다.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Socket.io로 실시간 업데이트 구독 (먼저 room에 join해야 이벤트를 받을 수 있음)
      // joinQueueSocket은 Promise를 반환하며, room join 완료를 기다림
      const joined = await joinQueueSocket();
      console.log('Socket room join result:', joined);

      // REST API로 티켓 대기열 진입
      const queuePosition = await joinTicketQueue(userId, eventId);
      console.log('Joined ticket queue:', queuePosition);

      setInQueue(true);
      setSuccessMessage('티켓 대기열에 진입했습니다.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to join ticket queue:', err);

      if (err.status === 429) {
        setError('티켓 대기열이 가득 찼습니다. 잠시 후 다시 시도해주세요.');
      } else if (err.status === 409) {
        setError('이미 티켓 대기열에 있습니다.');
        setInQueue(true);
      } else if (err.status === 404) {
        setError('이벤트를 찾을 수 없습니다.');
      } else if (err.status === 0) {
        setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setError(err.message || '티켓 대기열 진입에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * 티켓 대기열 이탈 처리
   */
  const handleLeaveQueue = () => {
    if (!userId) {
      return;
    }

    // Socket.io 이벤트 발송
    leaveQueueSocket();

    setInQueue(false);
    setSuccessMessage('티켓 대기열에서 나왔습니다.');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  /**
   * 이벤트 선택 화면으로 돌아가기
   */
  const handleBackToEvents = () => {
    if (inQueue) {
      if (!window.confirm('티켓 대기열에서 나가시겠습니까?')) {
        return;
      }
      leaveQueueSocket();
    }

    navigate('/events');
  };

  /**
   * 로그아웃 처리
   */
  const handleLogout = () => {
    if (inQueue) {
      if (!window.confirm('티켓 대기열에서 나가시겠습니까?')) {
        return;
      }
      leaveQueueSocket();
    }

    localStorage.removeItem('sessionToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    navigate('/register');
  };

  /**
   * 가용 좌석 비율 계산
   */
  const getAvailabilityPercentage = (available: number, capacity: number): number => {
    return Math.round((available / capacity) * 100);
  };

  if (!userId) {
    return (
      <div className="ticket-queue">
        <LoadingSpinner />
      </div>
    );
  }

  if (!event && !error) {
    return (
      <div className="ticket-queue">
        <div className="ticket-queue-loading">
          <LoadingSpinner />
          <p>이벤트 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ticket-queue">
      <div className="ticket-queue-container">
        {/* 헤더 */}
        <div className="ticket-queue-header">
          <div className="ticket-queue-user-info">
            <h2 className="ticket-queue-title">티켓 대기열</h2>
            <p className="ticket-queue-username">환영합니다, {username}님</p>
          </div>
          <button className="ticket-queue-logout" onClick={handleLogout}>
            로그아웃
          </button>
        </div>

        {/* 연결 상태 */}
        <div className={`ticket-queue-connection ${isConnected ? 'connected' : 'disconnected'}`}>
          <span className="connection-indicator" />
          <span className="connection-text">
            {isConnected ? '서버 연결됨' : '서버 연결 중...'}
          </span>
        </div>

        {/* 성공 메시지 */}
        {successMessage && (
          <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />
        )}

        {/* 에러 메시지 */}
        {error && (
          <ErrorMessage
            message={error}
            onRetry={!inQueue ? handleJoinQueue : undefined}
            onDismiss={() => setError(null)}
          />
        )}

        {/* 이벤트 정보 */}
        {event && (
          <div className="ticket-queue-event-info">
            <h3 className="event-info-title">선택한 이벤트</h3>
            <div className="event-info-card">
              <div className="event-info-header">
                <h4 className="event-info-name">{event.name}</h4>
                <span
                  className={`event-info-badge ${
                    event.available > 0 ? 'available' : 'sold-out'
                  }`}
                >
                  {event.available > 0 ? '예매 가능' : '매진'}
                </span>
              </div>
              <div className="event-info-details">
                <div className="event-info-item">
                  <span className="event-info-label">가용 좌석</span>
                  <span className="event-info-value">
                    {event.available} / {event.capacity}
                  </span>
                </div>
                <div className="event-info-item">
                  <span className="event-info-label">예매율</span>
                  <span className="event-info-value">
                    {100 - getAvailabilityPercentage(event.available, event.capacity)}%
                  </span>
                </div>
              </div>
              <div className="event-info-progress">
                <div className="event-info-progress-bar">
                  <div
                    className="event-info-progress-fill"
                    style={{
                      width: `${getAvailabilityPercentage(event.available, event.capacity)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 대기열 상태 */}
        {inQueue && status && (
          <QueueStatus
            position={position}
            totalWaiting={status.totalWaiting}
            estimatedWaitTime={position ? position * 30 : undefined}
            capacity={status.capacity}
          />
        )}

        {/* 대기열 진입/이탈 버튼 */}
        <div className="ticket-queue-actions">
          {!inQueue ? (
            <button
              className="ticket-queue-button join"
              onClick={handleJoinQueue}
              disabled={loading || !isConnected || (event ? event.available === 0 : false)}
            >
              {loading ? <LoadingSpinner /> : '티켓 대기열 진입'}
            </button>
          ) : (
            <div className="ticket-queue-waiting">
              <div className="waiting-message">
                <div className="waiting-icon">⏳</div>
                <p className="waiting-text">
                  {position !== null
                    ? `현재 ${position}번째로 대기 중입니다.`
                    : '곧 차례가 됩니다...'}
                </p>
              </div>
              <button
                className="ticket-queue-button leave"
                onClick={handleLeaveQueue}
                disabled={loading}
              >
                {loading ? <LoadingSpinner /> : '대기열 나가기'}
              </button>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="ticket-queue-bottom-actions">
          <button className="ticket-queue-back" onClick={handleBackToEvents}>
            이벤트 선택으로 돌아가기
          </button>
        </div>

        {/* 안내 메시지 */}
        <div className="ticket-queue-info">
          <h3 className="info-title">안내사항</h3>
          <ul className="info-list">
            <li>티켓 대기열에 진입하면 순서대로 티켓이 발급됩니다.</li>
            <li>실시간으로 대기 위치가 업데이트됩니다.</li>
            <li>차례가 되면 자동으로 티켓 화면으로 이동합니다.</li>
            <li>페이지를 새로고침하면 대기열에서 나가게 됩니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TicketQueue;
