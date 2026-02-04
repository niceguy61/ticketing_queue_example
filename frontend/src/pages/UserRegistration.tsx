import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '../api/userService';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import './UserRegistration.css';

/**
 * 사용자 등록 화면
 * 사용자명과 이메일을 입력받아 User Service에 등록 요청을 보냅니다.
 */
const UserRegistration: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    username?: string;
    email?: string;
  }>({});

  /**
   * 입력 검증
   */
  const validateForm = (): boolean => {
    const errors: { username?: string; email?: string } = {};

    // 사용자명 검증
    if (!username.trim()) {
      errors.username = '사용자명을 입력해주세요.';
    } else if (username.length < 2) {
      errors.username = '사용자명은 최소 2자 이상이어야 합니다.';
    } else if (username.length > 50) {
      errors.username = '사용자명은 최대 50자까지 입력 가능합니다.';
    } else if (!/^[a-zA-Z0-9가-힣_-]+$/.test(username)) {
      errors.username = '사용자명은 영문, 숫자, 한글, _, - 만 사용 가능합니다.';
    }

    // 이메일 검증
    if (!email.trim()) {
      errors.email = '이메일을 입력해주세요.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = '올바른 이메일 형식이 아닙니다.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * 등록 폼 제출 처리
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 입력 검증
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // User Service API 호출
      const user = await registerUser(username.trim(), email.trim());

      // 세션 토큰 저장
      localStorage.setItem('sessionToken', user.sessionToken);
      localStorage.setItem('userId', user.userId);
      localStorage.setItem('username', user.username);

      // 로비 대기열 화면으로 이동
      navigate('/lobby');
    } catch (err: any) {
      console.error('Registration failed:', err);
      
      // 에러 메시지 설정
      if (err.status === 409) {
        setError('이미 등록된 사용자명 또는 이메일입니다.');
      } else if (err.status === 400) {
        setError(err.message || '입력 정보가 올바르지 않습니다.');
      } else if (err.status === 0) {
        setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setError('등록 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * 입력 필드 변경 처리
   */
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
    // 입력 시 해당 필드의 검증 에러 제거
    if (validationErrors.username) {
      setValidationErrors({ ...validationErrors, username: undefined });
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    // 입력 시 해당 필드의 검증 에러 제거
    if (validationErrors.email) {
      setValidationErrors({ ...validationErrors, email: undefined });
    }
  };

  return (
    <div className="user-registration">
      <div className="user-registration-container">
        <div className="user-registration-header">
          <h1 className="user-registration-title">티케팅 대기열 시스템</h1>
          <p className="user-registration-subtitle">
            시작하려면 사용자 정보를 입력해주세요
          </p>
        </div>

        <form className="user-registration-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username" className="form-label">
              사용자명
            </label>
            <input
              id="username"
              type="text"
              className={`form-input ${validationErrors.username ? 'error' : ''}`}
              value={username}
              onChange={handleUsernameChange}
              placeholder="사용자명을 입력하세요"
              disabled={loading}
              autoComplete="username"
            />
            {validationErrors.username && (
              <span className="form-error">{validationErrors.username}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              이메일
            </label>
            <input
              id="email"
              type="email"
              className={`form-input ${validationErrors.email ? 'error' : ''}`}
              value={email}
              onChange={handleEmailChange}
              placeholder="email@example.com"
              disabled={loading}
              autoComplete="email"
            />
            {validationErrors.email && (
              <span className="form-error">{validationErrors.email}</span>
            )}
          </div>

          {error && (
            <ErrorMessage
              message={error}
              title="등록 실패"
              onDismiss={() => setError(null)}
            />
          )}

          <button
            type="submit"
            className="user-registration-button"
            disabled={loading}
          >
            {loading ? <LoadingSpinner /> : '등록하고 시작하기'}
          </button>
        </form>

        <div className="user-registration-footer">
          <p className="user-registration-info">
            등록 후 대기열에 진입하여 티켓을 발급받을 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserRegistration;
