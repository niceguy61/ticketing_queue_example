import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueue } from '../hooks/useQueue';
import { joinLobbyQueue, leaveLobbyQueue } from '../api/queueService';
import { QueueMode } from '../types';
import QueueStatus from '../components/QueueStatus';
import ErrorMessage from '../components/ErrorMessage';
import SuccessMessage from '../components/SuccessMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import './LobbyQueue.css';

interface LobbyQueueProps {
  queueMode: QueueMode;
}

/**
 * 로비 대기열 화면
 * Simple 모드: 직접 티켓 발급
 * Advanced 모드: 이벤트 선택 화면으로 이동
 */
const LobbyQueue: React.FC<LobbyQueueProps> = ({ queueMode }) => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
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
    mode: queueMode,
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

  // Advanced 모드: 차례가 되면 이벤트 선택 화면으로 이동
  // Simple 모드: 티켓 발급 완료 시 티켓 화면으로 이동
  useEffect(() => {
    if (ticket && inQueue) {
      if (queueMode === 'advanced' && (ticket as any).isYourTurn) {
        // Advanced 모드에서 차례가 되면 이벤트 선택으로 이동
        setSuccessMessage('차례가 되었습니다! 이벤트를 선택해주세요.');
        setTimeout(() => {
          navigate('/events');
        }, 1500);
      } else if (ticket.ticketId) {
        // Simple 모드 또는 티켓 대기열에서 티켓 발급 완료
        setSuccessMessage('티켓이 발급되었습니다!');
        setTimeout(() => {
          navigate(`/ticket/${ticket.ticketId}`);
        }, 1500);
      }
    }
  }, [queueMode, ticket, inQueue, navigate]);

  // Socket 에러 처리
  useEffect(() => {
    if (socketError) {
      setError(socketError);
    }
  }, [socketError]);

  /**
   * 대기열 진입 처리
   */
  const handleJoinQueue = async () => {
    if (!userId) {
      setError('사용자 정보를 찾을 수 없습니다.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Socket.io로 실시간 업데이트 구독 (먼저 room에 join해야 이벤트를 받을 수 있음)
      // joinQueueSocket은 Promise를 반환하며, room join 완료를 기다림
      const joined = await joinQueueSocket();
      console.log('Socket room join result:', joined);

      // REST API로 대기열 진입
      const queuePosition = await joinLobbyQueue(userId);
      console.log('Joined queue:', queuePosition);

      setInQueue(true);
      setSuccessMessage('대기열에 진입했습니다.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to join queue:', err);

      if (err.status === 429) {
        setError('대기열이 가득 찼습니다. 잠시 후 다시 시도해주세요.');
      } else if (err.status === 409) {
        setError('이미 대기열에 있습니다.');
        setInQueue(true);
      } else if (err.status === 0) {
        setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setError(err.message || '대기열 진입에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * 대기열 이탈 처리
   */
  const handleLeaveQueue = async () => {
    if (!userId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // REST API로 대기열 이탈
      await leaveLobbyQueue(userId);

      // Socket.io 이벤트 발송
      leaveQueueSocket();

      setInQueue(false);
      setSuccessMessage('대기열에서 나왔습니다.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to leave queue:', err);
      setError(err.message || '대기열 이탈에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 로그아웃 처리
   */
  const handleLogout = () => {
    if (inQueue) {
      if (!window.confirm('대기열에서 나가시겠습니까?')) {
        return;
      }
      leaveQueueSocket();
    }

    localStorage.removeItem('sessionToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    navigate('/register');
  };

  if (!userId) {
    return (
      <div className="lobby-queue">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="lobby-queue">
      <div className="lobby-queue-container">
        {/* 헤더 */}
        <div className="lobby-queue-header">
          <div className="lobby-queue-user-info">
            <h2 className="lobby-queue-title">
              {queueMode === 'simple' ? '로비 대기열' : '로비 대기열 (이벤트 선택 대기)'}
            </h2>
            <p className="lobby-queue-username">환영합니다, {username}님</p>
          </div>
          <button className="lobby-queue-logout" onClick={handleLogout}>
            로그아웃
          </button>
        </div>

        {/* 연결 상태 */}
        <div className={`lobby-queue-connection ${isConnected ? 'connected' : 'disconnected'}`}>
          <span className="connection-indicator" />
          <span className="connection-text">
            {isConnected ? '서버 연결됨' : '서버 연결 중...'}
          </span>
        </div>

        {/* 성공 메시지 */}
        {successMessage && (
          <SuccessMessage
            message={successMessage}
            onClose={() => setSuccessMessage(null)}
          />
        )}

        {/* 에러 메시지 */}
        {error && (
          <ErrorMessage
            message={error}
            onRetry={!inQueue ? handleJoinQueue : undefined}
            onDismiss={() => setError(null)}
          />
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
        <div className="lobby-queue-actions">
          {!inQueue ? (
            <button
              className="lobby-queue-button join"
              onClick={handleJoinQueue}
              disabled={loading || !isConnected}
            >
              {loading ? <LoadingSpinner /> : '대기열 진입'}
            </button>
          ) : (
            <div className="lobby-queue-waiting">
              <div className="waiting-message">
                <div className="waiting-icon">⏳</div>
                <p className="waiting-text">
                  {position !== null
                    ? `현재 ${position}번째로 대기 중입니다.`
                    : '곧 차례가 됩니다...'}
                </p>
              </div>
              <button
                className="lobby-queue-button leave"
                onClick={handleLeaveQueue}
                disabled={loading}
              >
                {loading ? <LoadingSpinner /> : '대기열 나가기'}
              </button>
            </div>
          )}
        </div>

        {/* 안내 메시지 */}
        <div className="lobby-queue-info">
          <h3 className="info-title">안내사항</h3>
          <ul className="info-list">
            {queueMode === 'simple' ? (
              <>
                <li>대기열에 진입하면 순서대로 티켓이 발급됩니다.</li>
                <li>실시간으로 대기 위치가 업데이트됩니다.</li>
                <li>차례가 되면 자동으로 티켓 화면으로 이동합니다.</li>
                <li>페이지를 새로고침하면 대기열에서 나가게 됩니다.</li>
              </>
            ) : (
              <>
                <li>로비 대기열에 진입하면 순서대로 처리됩니다.</li>
                <li>실시간으로 대기 위치가 업데이트됩니다.</li>
                <li>차례가 되면 이벤트 선택 화면으로 이동합니다.</li>
                <li>이벤트를 선택한 후 티켓 대기열에서 티켓을 받을 수 있습니다.</li>
                <li>페이지를 새로고침하면 대기열에서 나가게 됩니다.</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LobbyQueue;
