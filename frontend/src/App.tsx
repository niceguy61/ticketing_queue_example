import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LobbyQueue from './pages/LobbyQueue';
import EventSelection from './pages/EventSelection';
import TicketQueue from './pages/TicketQueue';
import UserRegistration from './pages/UserRegistration';
import TicketDisplay from './pages/TicketDisplay';
import { getQueueMode } from './api/queueService';
import { QueueMode } from './types';
import './App.css';

const App: React.FC = () => {
  const [queueMode, setQueueMode] = useState<QueueMode>('simple');
  const [modeLoaded, setModeLoaded] = useState(false);

  // 큐 모드 로드
  useEffect(() => {
    loadQueueMode();
  }, []);

  const loadQueueMode = async () => {
    try {
      const response = await getQueueMode();
      setQueueMode(response.mode);
    } catch (error) {
      console.error('Failed to load queue mode:', error);
      // 기본값 simple 사용
      setQueueMode('simple');
    } finally {
      setModeLoaded(true);
    }
  };

  if (!modeLoaded) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>시스템 초기화 중...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="app">
        {/* 모드 표시 배너 */}
        <div className={`mode-banner ${queueMode}`}>
          <div className="mode-banner-content">
            <span className="mode-badge">
              {queueMode === 'simple' ? '단순 모드' : '고급 모드'}
            </span>
            <span className="mode-description">
              {queueMode === 'simple'
                ? '로비 대기열만 사용'
                : '로비 + 티케팅별 대기열 사용'}
            </span>
          </div>
        </div>

        <Routes>
          <Route path="/" element={<Navigate to="/register" replace />} />
          <Route path="/register" element={<UserRegistration />} />
          <Route path="/lobby" element={<LobbyQueue queueMode={queueMode} />} />
          {queueMode === 'advanced' && (
            <>
              <Route path="/events" element={<EventSelection />} />
              <Route path="/ticket-queue/:eventId" element={<TicketQueue />} />
            </>
          )}
          <Route path="/ticket/:ticketId" element={<TicketDisplay />} />
          {/* 잘못된 경로는 등록 화면으로 리다이렉트 */}
          <Route path="*" element={<Navigate to="/register" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
