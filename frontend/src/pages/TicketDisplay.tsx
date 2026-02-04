import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { verifyTicket, getUserTickets } from '../api/ticketService';
import { Ticket } from '../types';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import './TicketDisplay.css';

/**
 * 티켓 발급 완료 화면
 * 발급된 티켓 정보를 표시하고 QR 코드를 생성합니다 (선택적).
 */
const TicketDisplay: React.FC = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);

  // 티켓 정보 로드
  useEffect(() => {
    const loadTicket = async () => {
      if (!ticketId) {
        setError('티켓 ID가 없습니다.');
        setLoading(false);
        return;
      }

      try {
        // 티켓 검증
        const verification = await verifyTicket(ticketId);
        
        if (!verification.valid) {
          setVerificationStatus({
            valid: false,
            message: '유효하지 않은 티켓입니다.',
          });
          setLoading(false);
          return;
        }

        // 사용자 티켓 목록에서 해당 티켓 찾기
        const userId = localStorage.getItem('userId');
        if (userId) {
          const { tickets } = await getUserTickets(userId);
          const foundTicket = tickets.find((t) => t.ticketId === ticketId);
          
          if (foundTicket) {
            setTicket(foundTicket);
            setVerificationStatus({
              valid: true,
              message: '유효한 티켓입니다.',
            });
          } else {
            setError('티켓 정보를 찾을 수 없습니다.');
          }
        }
      } catch (err: any) {
        console.error('Failed to load ticket:', err);
        
        if (err.status === 404) {
          setError('티켓을 찾을 수 없습니다.');
        } else if (err.status === 0) {
          setError('서버에 연결할 수 없습니다.');
        } else {
          setError(err.message || '티켓 정보를 불러오는데 실패했습니다.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadTicket();
  }, [ticketId]);

  /**
   * 날짜 포맷팅
   */
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * 남은 시간 계산
   */
  const getTimeRemaining = (expiresAt: string): string => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();

    if (diff <= 0) {
      return '만료됨';
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}시간 ${minutes}분 남음`;
    }
    return `${minutes}분 남음`;
  };

  /**
   * 티켓 상태 텍스트
   */
  const getStatusText = (status: string): string => {
    switch (status) {
      case 'active':
        return '활성';
      case 'used':
        return '사용됨';
      case 'expired':
        return '만료됨';
      case 'cancelled':
        return '취소됨';
      default:
        return status;
    }
  };

  /**
   * 티켓 상태 클래스
   */
  const getStatusClass = (status: string): string => {
    switch (status) {
      case 'active':
        return 'active';
      case 'used':
        return 'used';
      case 'expired':
        return 'expired';
      case 'cancelled':
        return 'cancelled';
      default:
        return '';
    }
  };

  /**
   * 로비로 돌아가기
   */
  const handleBackToLobby = () => {
    navigate('/lobby');
  };

  if (loading) {
    return (
      <div className="ticket-display">
        <div className="ticket-display-container">
          <LoadingSpinner />
          <p className="loading-text">티켓 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ticket-display">
        <div className="ticket-display-container">
          <ErrorMessage
            message={error}
            title="티켓 로드 실패"
            onRetry={() => window.location.reload()}
          />
          <button className="ticket-display-button back" onClick={handleBackToLobby}>
            로비로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="ticket-display">
        <div className="ticket-display-container">
          <ErrorMessage message="티켓 정보를 찾을 수 없습니다." />
          <button className="ticket-display-button back" onClick={handleBackToLobby}>
            로비로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ticket-display">
      <div className="ticket-display-container">
        {/* 헤더 */}
        <div className="ticket-display-header">
          <h1 className="ticket-display-title">티켓 발급 완료</h1>
          <p className="ticket-display-subtitle">
            티켓이 성공적으로 발급되었습니다
          </p>
        </div>

        {/* 검증 상태 */}
        {verificationStatus && (
          <div
            className={`ticket-verification ${
              verificationStatus.valid ? 'valid' : 'invalid'
            }`}
          >
            <span className="verification-icon">
              {verificationStatus.valid ? '✓' : '✗'}
            </span>
            <span className="verification-text">{verificationStatus.message}</span>
          </div>
        )}

        {/* 티켓 카드 */}
        <div className="ticket-card">
          {/* 티켓 상태 배지 */}
          <div className={`ticket-status-badge ${getStatusClass(ticket.status)}`}>
            {getStatusText(ticket.status)}
          </div>

          {/* QR 코드 영역 (선택적) */}
          <div className="ticket-qr-section">
            <div className="ticket-qr-placeholder">
              <div className="qr-icon">📱</div>
              <p className="qr-text">QR 코드</p>
              <p className="qr-subtext">(구현 예정)</p>
            </div>
          </div>

          {/* 티켓 정보 */}
          <div className="ticket-info-section">
            <div className="ticket-info-item">
              <span className="ticket-info-label">티켓 ID</span>
              <span className="ticket-info-value ticket-id">{ticket.ticketId}</span>
            </div>

            <div className="ticket-info-item">
              <span className="ticket-info-label">사용자 ID</span>
              <span className="ticket-info-value">{ticket.userId}</span>
            </div>

            {ticket.eventId && (
              <div className="ticket-info-item">
                <span className="ticket-info-label">이벤트 ID</span>
                <span className="ticket-info-value">{ticket.eventId}</span>
              </div>
            )}

            <div className="ticket-info-item">
              <span className="ticket-info-label">발급 시간</span>
              <span className="ticket-info-value">{formatDate(ticket.issuedAt)}</span>
            </div>

            <div className="ticket-info-item">
              <span className="ticket-info-label">만료 시간</span>
              <span className="ticket-info-value">{formatDate(ticket.expiresAt)}</span>
            </div>

            {ticket.status === 'active' && (
              <div className="ticket-info-item highlight">
                <span className="ticket-info-label">유효 기간</span>
                <span className="ticket-info-value">
                  {getTimeRemaining(ticket.expiresAt)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 안내 메시지 */}
        <div className="ticket-notice">
          <h3 className="notice-title">안내사항</h3>
          <ul className="notice-list">
            <li>이 티켓은 {formatDate(ticket.expiresAt)}까지 유효합니다.</li>
            <li>티켓 ID를 안전하게 보관해주세요.</li>
            <li>티켓은 한 번만 사용할 수 있습니다.</li>
            <li>만료된 티켓은 사용할 수 없습니다.</li>
          </ul>
        </div>

        {/* 액션 버튼 */}
        <div className="ticket-display-actions">
          <button className="ticket-display-button back" onClick={handleBackToLobby}>
            로비로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketDisplay;
