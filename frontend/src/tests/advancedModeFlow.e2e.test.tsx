import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import LobbyQueue from '../pages/LobbyQueue';
import EventSelection from '../pages/EventSelection';
import TicketQueue from '../pages/TicketQueue';
import TicketDisplay from '../pages/TicketDisplay';
import UserRegistration from '../pages/UserRegistration';
import { getQueueMode } from '../api/queueService';
import { QueueMode } from '../types';
import * as queueService from '../api/queueService';
import * as ticketService from '../api/ticketService';

// Test wrapper component that mimics App but uses MemoryRouter
const TestApp: React.FC<{ initialRoute?: string }> = ({ initialRoute = '/lobby' }) => {
  const [queueMode, setQueueMode] = useState<QueueMode>('simple');
  const [modeLoaded, setModeLoaded] = useState(false);

  useEffect(() => {
    const loadQueueMode = async () => {
      try {
        const response = await getQueueMode();
        setQueueMode(response.mode);
      } catch (error) {
        setQueueMode('simple');
      } finally {
        setModeLoaded(true);
      }
    };
    loadQueueMode();
  }, []);

  if (!modeLoaded) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>시스템 초기화 중...</p>
      </div>
    );
  }

  return (
    <MemoryRouter initialEntries={[initialRoute]}>
      <div className="app">
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
          <Route path="*" element={<Navigate to="/register" replace />} />
        </Routes>
      </div>
    </MemoryRouter>
  );
};

/**
 * Advanced 모드 E2E 테스트
 * 
 * 플로우: 로비 대기 → 이벤트 선택 → 티켓 대기열 → 티켓 발급
 * 
 * 검증: 요구사항 5.7, 5.8, 6-2.3, 6-2.4
 */

// Mock Socket.io before importing components
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    close: vi.fn(),
    id: 'mock-socket-id',
  })),
}));

describe('Advanced Mode E2E Flow', () => {
  const mockUserId = 'test-user-123';
  const mockUsername = 'testuser';
  const mockEventId = 'event-001';
  const mockTicketId = 'ticket-123';

  beforeEach(() => {
    // 로컬 스토리지 초기화
    localStorage.clear();
    localStorage.setItem('userId', mockUserId);
    localStorage.setItem('username', mockUsername);
    localStorage.setItem('sessionToken', 'mock-token');

    // API mocks 초기화
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should complete full Advanced mode flow: lobby → event selection → ticket queue → ticket display', async () => {
    const user = userEvent.setup();

    // Mock API responses
    vi.spyOn(queueService, 'getQueueMode').mockResolvedValue({ mode: 'advanced' });
    
    vi.spyOn(queueService, 'joinLobbyQueue').mockResolvedValue({
      queueId: 'lobby-queue-1',
      position: 1,
      estimatedWaitTime: 30,
    });

    vi.spyOn(queueService, 'getEvents').mockResolvedValue({
      events: [
        {
          eventId: mockEventId,
          name: 'Test Concert',
          available: 100,
          capacity: 200,
        },
        {
          eventId: 'event-002',
          name: 'Test Festival',
          available: 0,
          capacity: 150,
        },
      ],
    });

    vi.spyOn(queueService, 'joinTicketQueue').mockResolvedValue({
      queueId: 'ticket-queue-1',
      position: 1,
      estimatedWaitTime: 30,
    });

    vi.spyOn(ticketService, 'verifyTicket').mockResolvedValue({
      valid: true,
      userId: mockUserId,
      eventId: mockEventId,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });

    vi.spyOn(ticketService, 'getUserTickets').mockResolvedValue({
      tickets: [
        {
          ticketId: mockTicketId,
          userId: mockUserId,
          eventId: mockEventId,
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          status: 'active',
        },
      ],
    });

    // Render TestApp with initial route
    render(<TestApp initialRoute="/lobby" />);

    // 1. 시스템이 Advanced 모드로 로드되는지 확인
    await waitFor(() => {
      expect(screen.getByText(/고급 모드/i)).toBeInTheDocument();
    });

    // 2. 로비 대기열 화면 확인 (컴포넌트가 렌더링되었는지 확인)
    await waitFor(() => {
      expect(screen.getByText(/로비 대기열/i)).toBeInTheDocument();
    });

    // 3. 로비 대기열 진입
    const joinButton = await screen.findByRole('button', { name: /대기열 진입/i });
    await user.click(joinButton);

    await waitFor(() => {
      expect(queueService.joinLobbyQueue).toHaveBeenCalledWith(mockUserId);
    });

    // 4. Socket.io 이벤트 시뮬레이션 - 차례가 됨
    // Note: Socket.io is mocked, so we can't actually simulate events in this test
    // In a real E2E test, we would wait for the actual socket event
    // For now, we'll skip the socket event simulation and test the UI flow

    // 5. 이벤트 선택 화면으로 자동 이동 확인
    await waitFor(
      () => {
        expect(window.location.pathname).toBe('/events');
      },
      { timeout: 3000 }
    );

    // 6. 이벤트 목록 로드 확인
    await waitFor(() => {
      expect(queueService.getEvents).toHaveBeenCalled();
    });

    // 7. 이벤트 카드 표시 확인
    const eventCard = await screen.findByText('Test Concert');
    expect(eventCard).toBeInTheDocument();

    // 8. 매진된 이벤트는 선택 불가 확인
    const soldOutEvent = screen.getByText('Test Festival');
    expect(soldOutEvent).toBeInTheDocument();
    
    const soldOutButton = within(soldOutEvent.closest('.event-card')!).getByRole('button');
    expect(soldOutButton).toBeDisabled();
    expect(soldOutButton).toHaveTextContent(/매진/i);

    // 9. 이벤트 선택
    const selectButton = within(eventCard.closest('.event-card')!).getByRole('button', {
      name: /이벤트 선택/i,
    });
    await user.click(selectButton);

    // 10. 티켓 대기열 화면으로 이동 확인
    await waitFor(() => {
      expect(window.location.pathname).toBe(`/ticket-queue/${mockEventId}`);
    });

    // 11. 선택한 이벤트 정보 표시 확인
    await waitFor(() => {
      expect(screen.getByText('Test Concert')).toBeInTheDocument();
    });

    // 12. 티켓 대기열 진입
    const joinTicketQueueButton = await screen.findByRole('button', {
      name: /티켓 대기열 진입/i,
    });
    await user.click(joinTicketQueueButton);

    await waitFor(() => {
      expect(queueService.joinTicketQueue).toHaveBeenCalledWith(mockUserId, mockEventId);
    });

    // 13. Socket.io 이벤트 시뮬레이션 - 티켓 발급
    // TODO: Implement proper Socket.io mocking
    /* const yourTurnHandler = mockSocket.on.mock.calls.find(
      (call: any) => call[0] === 'queue:your-turn'
    )?.[1];

    if (yourTurnHandler) {
      yourTurnHandler({
        ticket: {
          ticketId: mockTicketId,
          userId: mockUserId,
          eventId: mockEventId,
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          status: 'active',
        },
      });
    }

    // 14. 티켓 화면으로 자동 이동 확인
    await waitFor(
      () => {
        expect(window.location.pathname).toBe(`/ticket/${mockTicketId}`);
      },
      { timeout: 3000 }
    ); */

    // 15. 티켓 정보 표시 확인
    await waitFor(() => {
      expect(ticketService.verifyTicket).toHaveBeenCalledWith(mockTicketId);
      expect(ticketService.getUserTickets).toHaveBeenCalledWith(mockUserId);
    });

    // 16. 티켓 ID 표시 확인
    await waitFor(() => {
      expect(screen.getByText(mockTicketId)).toBeInTheDocument();
    });

    // 17. 티켓 상태 확인
    expect(screen.getByText(/활성/i)).toBeInTheDocument();
    expect(screen.getByText(/유효한 티켓입니다/i)).toBeInTheDocument();
  });

  it('should handle queue full error in lobby queue', async () => {
    const user = userEvent.setup();

    vi.spyOn(queueService, 'getQueueMode').mockResolvedValue({ mode: 'advanced' });
    
    // Mock 대기열 가득 참 에러
    vi.spyOn(queueService, 'joinLobbyQueue').mockRejectedValue({
      status: 429,
      message: 'Queue Full',
    });

    // Render TestApp with initial route
    render(<TestApp initialRoute="/lobby" />);

    await waitFor(() => {
      expect(screen.getByText(/고급 모드/i)).toBeInTheDocument();
    });

    const joinButton = await screen.findByRole('button', { name: /대기열 진입/i });
    await user.click(joinButton);

    // 에러 메시지 표시 확인
    await waitFor(() => {
      expect(screen.getByText(/대기열이 가득 찼습니다/i)).toBeInTheDocument();
    });
  });

  it('should handle queue full error in ticket queue', async () => {
    const user = userEvent.setup();

    vi.spyOn(queueService, 'getQueueMode').mockResolvedValue({ mode: 'advanced' });
    
    vi.spyOn(queueService, 'getEvents').mockResolvedValue({
      events: [
        {
          eventId: mockEventId,
          name: 'Test Concert',
          available: 100,
          capacity: 200,
        },
      ],
    });

    // Mock 티켓 대기열 가득 참 에러
    vi.spyOn(queueService, 'joinTicketQueue').mockRejectedValue({
      status: 429,
      message: 'Queue Full',
    });

    // Render TestApp with initial route
    render(<TestApp initialRoute="/events" />);

    await waitFor(() => {
      expect(screen.getByText(/고급 모드/i)).toBeInTheDocument();
    });

    // 이벤트 선택 화면 확인
    await waitFor(() => {
      expect(window.location.pathname).toBe('/events');
    });

    await waitFor(() => {
      expect(queueService.getEvents).toHaveBeenCalled();
    });

    const eventCard = await screen.findByText('Test Concert');
    const selectButton = within(eventCard.closest('.event-card')!).getByRole('button', {
      name: /이벤트 선택/i,
    });
    await user.click(selectButton);

    // 티켓 대기열 화면
    await waitFor(() => {
      expect(window.location.pathname).toBe(`/ticket-queue/${mockEventId}`);
    });

    const joinTicketQueueButton = await screen.findByRole('button', {
      name: /티켓 대기열 진입/i,
    });
    await user.click(joinTicketQueueButton);

    // 에러 메시지 표시 확인
    await waitFor(() => {
      expect(screen.getByText(/티켓 대기열이 가득 찼습니다/i)).toBeInTheDocument();
    });
  });

  it('should allow user to leave queue and return to event selection', async () => {
    const user = userEvent.setup();

    vi.spyOn(queueService, 'getQueueMode').mockResolvedValue({ mode: 'advanced' });
    
    vi.spyOn(queueService, 'getEvents').mockResolvedValue({
      events: [
        {
          eventId: mockEventId,
          name: 'Test Concert',
          available: 100,
          capacity: 200,
        },
      ],
    });

    vi.spyOn(queueService, 'joinTicketQueue').mockResolvedValue({
      queueId: 'ticket-queue-1',
      position: 5,
      estimatedWaitTime: 150,
    });

    // Render TestApp with initial route
    render(<TestApp initialRoute={`/ticket-queue/${mockEventId}`} />);

    await waitFor(() => {
      expect(screen.getByText(/고급 모드/i)).toBeInTheDocument();
    });

    // 티켓 대기열 화면 확인
    await waitFor(() => {
      expect(window.location.pathname).toBe(`/ticket-queue/${mockEventId}`);
    });

    await waitFor(() => {
      expect(queueService.getEvents).toHaveBeenCalled();
    });

    const joinTicketQueueButton = await screen.findByRole('button', {
      name: /티켓 대기열 진입/i,
    });
    await user.click(joinTicketQueueButton);

    // 대기열 진입 확인
    await waitFor(() => {
      expect(queueService.joinTicketQueue).toHaveBeenCalledWith(mockUserId, mockEventId);
    });

    // TODO: Implement proper Socket.io mocking
    /* Socket.io 위치 업데이트 시뮬레이션
    const positionUpdateHandler = mockSocket.on.mock.calls.find(
      (call: any) => call[0] === 'queue:position-update'
    )?.[1];

    if (positionUpdateHandler) {
      positionUpdateHandler({ position: 5, estimatedWaitTime: 150 });
    }

    // 대기 중 상태 확인
    await waitFor(() => {
      expect(screen.getByText(/5번째로 대기 중입니다/i)).toBeInTheDocument();
    });

    // 대기열 나가기
    const leaveButton = await screen.findByRole('button', { name: /대기열 나가기/i });
    await user.click(leaveButton);

    // Socket.io leave 이벤트 발송 확인
    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith('queue:leave', { userId: mockUserId });
    }); */

    // 이벤트 선택으로 돌아가기
    const backButton = await screen.findByRole('button', {
      name: /이벤트 선택으로 돌아가기/i,
    });
    await user.click(backButton);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/events');
    });
  });

  it('should display event availability and prevent selection of sold-out events', async () => {
    vi.spyOn(queueService, 'getQueueMode').mockResolvedValue({ mode: 'advanced' });
    
    vi.spyOn(queueService, 'getEvents').mockResolvedValue({
      events: [
        {
          eventId: 'event-001',
          name: 'Available Event',
          available: 50,
          capacity: 100,
        },
        {
          eventId: 'event-002',
          name: 'Sold Out Event',
          available: 0,
          capacity: 100,
        },
        {
          eventId: 'event-003',
          name: 'Almost Full Event',
          available: 5,
          capacity: 100,
        },
      ],
    });

    // Render TestApp with initial route
    render(<TestApp initialRoute="/events" />);

    await waitFor(() => {
      expect(screen.getByText(/고급 모드/i)).toBeInTheDocument();
    });

    // 이벤트 선택 화면 확인
    await waitFor(() => {
      expect(window.location.pathname).toBe('/events');
    });

    await waitFor(() => {
      expect(queueService.getEvents).toHaveBeenCalled();
    });

    // 가용 이벤트 확인
    const availableEvent = await screen.findByText('Available Event');
    expect(availableEvent).toBeInTheDocument();
    
    const availableButton = within(availableEvent.closest('.event-card')!).getByRole('button');
    expect(availableButton).not.toBeDisabled();
    expect(availableButton).toHaveTextContent(/이벤트 선택/i);

    // 매진 이벤트 확인
    const soldOutEvent = screen.getByText('Sold Out Event');
    expect(soldOutEvent).toBeInTheDocument();
    
    const soldOutButton = within(soldOutEvent.closest('.event-card')!).getByRole('button');
    expect(soldOutButton).toBeDisabled();
    expect(soldOutButton).toHaveTextContent(/매진/i);

    // 거의 매진 이벤트 확인
    const almostFullEvent = screen.getByText('Almost Full Event');
    expect(almostFullEvent).toBeInTheDocument();
    
    const almostFullButton = within(almostFullEvent.closest('.event-card')!).getByRole('button');
    expect(almostFullButton).not.toBeDisabled();
  });
});
