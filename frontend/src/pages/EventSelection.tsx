import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEvents } from '../api/queueService';
import { Event } from '../types';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import './EventSelection.css';

/**
 * 이벤트 선택 화면 (Advanced 모드)
 * 사용자가 티케팅 이벤트를 선택할 수 있습니다.
 */
const EventSelection: React.FC = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // 이벤트 목록 로드
  useEffect(() => {
    if (!userId) {
      return;
    }

    loadEvents();
  }, [userId]);

  /**
   * 이벤트 목록 로드
   */
  const loadEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getEvents();
      setEvents(response.events);
    } catch (err: any) {
      console.error('Failed to load events:', err);
      setError(err.message || '이벤트 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 이벤트 선택 처리
   */
  const handleSelectEvent = (eventId: string) => {
    if (!userId) {
      setError('사용자 정보를 찾을 수 없습니다.');
      return;
    }

    // 티켓 대기열 화면으로 이동
    navigate(`/ticket-queue/${eventId}`);
  };

  /**
   * 로비로 돌아가기
   */
  const handleBackToLobby = () => {
    navigate('/lobby');
  };

  /**
   * 로그아웃 처리
   */
  const handleLogout = () => {
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

  /**
   * 가용 좌석 상태 클래스 반환
   */
  const getAvailabilityClass = (available: number, capacity: number): string => {
    const percentage = getAvailabilityPercentage(available, capacity);
    if (percentage > 50) return 'high';
    if (percentage > 20) return 'medium';
    return 'low';
  };

  if (!userId) {
    return (
      <div className="event-selection">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="event-selection">
      <div className="event-selection-container">
        {/* 헤더 */}
        <div className="event-selection-header">
          <div className="event-selection-user-info">
            <h2 className="event-selection-title">티케팅 이벤트 선택</h2>
            <p className="event-selection-username">환영합니다, {username}님</p>
          </div>
          <button className="event-selection-logout" onClick={handleLogout}>
            로그아웃
          </button>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <ErrorMessage
            message={error}
            onRetry={loadEvents}
            onDismiss={() => setError(null)}
          />
        )}

        {/* 로딩 상태 */}
        {loading ? (
          <div className="event-selection-loading">
            <LoadingSpinner />
            <p>이벤트 목록을 불러오는 중...</p>
          </div>
        ) : (
          <>
            {/* 이벤트 목록 */}
            {events.length > 0 ? (
              <div className="event-selection-list">
                {events.map((event) => (
                  <div key={event.eventId} className="event-card">
                    <div className="event-card-header">
                      <h3 className="event-card-title">{event.name}</h3>
                      <span
                        className={`event-card-badge ${getAvailabilityClass(
                          event.available,
                          event.capacity
                        )}`}
                      >
                        {event.available > 0 ? '예매 가능' : '매진'}
                      </span>
                    </div>

                    <div className="event-card-body">
                      <div className="event-card-info">
                        <div className="event-card-info-item">
                          <span className="event-card-label">가용 좌석</span>
                          <span className="event-card-value">
                            {event.available} / {event.capacity}
                          </span>
                        </div>
                        <div className="event-card-info-item">
                          <span className="event-card-label">예매율</span>
                          <span className="event-card-value">
                            {100 - getAvailabilityPercentage(event.available, event.capacity)}%
                          </span>
                        </div>
                      </div>

                      {/* 가용 좌석 진행 바 */}
                      <div className="event-card-progress">
                        <div className="event-card-progress-bar">
                          <div
                            className={`event-card-progress-fill ${getAvailabilityClass(
                              event.available,
                              event.capacity
                            )}`}
                            style={{
                              width: `${getAvailabilityPercentage(event.available, event.capacity)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* 선택 버튼 */}
                      <button
                        className="event-card-button"
                        onClick={() => handleSelectEvent(event.eventId)}
                        disabled={event.available === 0}
                      >
                        {event.available > 0 ? '이벤트 선택' : '매진'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="event-selection-empty">
                <p>현재 진행 중인 이벤트가 없습니다.</p>
              </div>
            )}

            {/* 하단 버튼 */}
            <div className="event-selection-actions">
              <button className="event-selection-back" onClick={handleBackToLobby}>
                로비로 돌아가기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EventSelection;
