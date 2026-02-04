import React from 'react';
import './ErrorMessage.css';

interface ErrorMessageProps {
  message: string;
  title?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

/**
 * 에러 메시지 컴포넌트
 * 에러 발생 시 사용자에게 알림을 표시합니다.
 */
const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  title = '오류 발생',
  onRetry,
  onDismiss,
}) => {
  return (
    <div className="error-message">
      <div className="error-message-icon">⚠️</div>
      <div className="error-message-content">
        <h3 className="error-message-title">{title}</h3>
        <p className="error-message-text">{message}</p>
      </div>
      <div className="error-message-actions">
        {onRetry && (
          <button className="error-message-button retry" onClick={onRetry}>
            다시 시도
          </button>
        )}
        {onDismiss && (
          <button className="error-message-button dismiss" onClick={onDismiss}>
            닫기
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;
