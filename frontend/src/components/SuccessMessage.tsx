import React from 'react';
import './SuccessMessage.css';

interface SuccessMessageProps {
  message: string;
  title?: string;
  onClose?: () => void;
}

/**
 * 성공 메시지 컴포넌트
 * 작업 성공 시 사용자에게 알림을 표시합니다.
 */
const SuccessMessage: React.FC<SuccessMessageProps> = ({
  message,
  title = '성공',
  onClose,
}) => {
  return (
    <div className="success-message">
      <div className="success-message-icon">✓</div>
      <div className="success-message-content">
        <h3 className="success-message-title">{title}</h3>
        <p className="success-message-text">{message}</p>
      </div>
      {onClose && (
        <button className="success-message-close" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  );
};

export default SuccessMessage;
