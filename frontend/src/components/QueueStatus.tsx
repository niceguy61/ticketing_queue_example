import React from 'react';
import './QueueStatus.css';

interface QueueStatusProps {
  position: number | null;
  totalWaiting: number;
  estimatedWaitTime?: number;
  capacity?: number;
}

/**
 * 대기열 상태 표시 컴포넌트
 * 현재 대기 위치, 전체 대기 인원, 예상 대기 시간을 표시합니다.
 */
const QueueStatus: React.FC<QueueStatusProps> = ({
  position,
  totalWaiting,
  estimatedWaitTime,
  capacity,
}) => {
  const formatWaitTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}초`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}분`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}시간 ${remainingMinutes}분`;
  };

  return (
    <div className="queue-status">
      <div className="queue-status-card">
        <h2 className="queue-status-title">대기열 상태</h2>
        
        <div className="queue-status-grid">
          {position !== null && (
            <div className="queue-status-item highlight">
              <div className="queue-status-label">내 대기 순서</div>
              <div className="queue-status-value large">{position}번째</div>
            </div>
          )}
          
          <div className="queue-status-item">
            <div className="queue-status-label">전체 대기 인원</div>
            <div className="queue-status-value">
              {totalWaiting}명
              {capacity && ` / ${capacity}명`}
            </div>
          </div>
          
          {estimatedWaitTime !== undefined && estimatedWaitTime > 0 && (
            <div className="queue-status-item">
              <div className="queue-status-label">예상 대기 시간</div>
              <div className="queue-status-value">
                약 {formatWaitTime(estimatedWaitTime)}
              </div>
            </div>
          )}
        </div>
        
        {capacity && (
          <div className="queue-status-progress">
            <div className="queue-status-progress-label">
              대기열 사용률: {Math.round((totalWaiting / capacity) * 100)}%
            </div>
            <div className="queue-status-progress-bar">
              <div
                className="queue-status-progress-fill"
                style={{ width: `${Math.min((totalWaiting / capacity) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QueueStatus;
