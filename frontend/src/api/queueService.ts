import { queueApi } from './client';
import { QueuePosition, QueueStatus, Event } from '../types';

/**
 * 로비 대기열 진입
 * @param userId 사용자 ID
 * @returns 대기열 위치 정보
 */
export const joinLobbyQueue = async (userId: string): Promise<QueuePosition> => {
  const response = await queueApi.post<QueuePosition>('/api/queue/lobby/join', {
    userId,
  });
  return response.data;
};

/**
 * 로비 대기열 상태 조회
 * @returns 대기열 상태
 */
export const getLobbyQueueStatus = async (): Promise<QueueStatus> => {
  const response = await queueApi.get<QueueStatus>('/api/queue/lobby/status');
  return response.data;
};

/**
 * 로비 대기열 위치 조회
 * @param userId 사용자 ID
 * @returns 대기열 위치 정보
 */
export const getLobbyQueuePosition = async (
  userId: string
): Promise<{ position: number; estimatedWaitTime: number }> => {
  const response = await queueApi.get<{ position: number; estimatedWaitTime: number }>(
    `/api/queue/lobby/position/${userId}`
  );
  return response.data;
};

/**
 * 로비 대기열 이탈
 * @param userId 사용자 ID
 * @returns 성공 여부
 */
export const leaveLobbyQueue = async (userId: string): Promise<{ success: boolean }> => {
  const response = await queueApi.delete<{ success: boolean }>(
    `/api/queue/lobby/leave/${userId}`
  );
  return response.data;
};

/**
 * 큐 모드 조회
 * @returns 현재 큐 모드 (simple 또는 advanced)
 */
export const getQueueMode = async (): Promise<{ mode: 'simple' | 'advanced' }> => {
  try {
    const response = await queueApi.get<{ mode: 'simple' | 'advanced' }>('/api/queue/mode');
    return response.data;
  } catch (error) {
    // 기본값으로 simple 모드 반환
    console.warn('Failed to get queue mode, defaulting to simple:', error);
    return { mode: 'simple' };
  }
};

/**
 * 티케팅 이벤트 목록 조회 (Advanced 모드)
 * @returns 이벤트 목록
 */
export const getEvents = async (): Promise<{ events: Event[] }> => {
  const response = await queueApi.get<{ events: Event[] }>('/api/queue/events');
  return response.data;
};

/**
 * 티케팅별 대기열 진입 (Advanced 모드)
 * @param userId 사용자 ID
 * @param eventId 이벤트 ID
 * @returns 대기열 위치 정보
 */
export const joinTicketQueue = async (
  userId: string,
  eventId: string
): Promise<QueuePosition> => {
  const response = await queueApi.post<QueuePosition>('/api/queue/ticket/join', {
    userId,
    eventId,
  });
  return response.data;
};

/**
 * 티케팅별 대기열 상태 조회 (Advanced 모드)
 * @param eventId 이벤트 ID
 * @returns 대기열 상태
 */
export const getTicketQueueStatus = async (eventId: string): Promise<QueueStatus> => {
  const response = await queueApi.get<QueueStatus>(`/api/queue/ticket/${eventId}/status`);
  return response.data;
};
