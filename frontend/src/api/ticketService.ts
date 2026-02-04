import { ticketApi } from './client';
import { Ticket } from '../types';

/**
 * 티켓 검증
 * @param ticketId 티켓 ID
 * @returns 티켓 검증 결과
 */
export const verifyTicket = async (
  ticketId: string
): Promise<{
  valid: boolean;
  userId: string;
  eventId?: string;
  expiresAt: string;
}> => {
  const response = await ticketApi.get<{
    valid: boolean;
    userId: string;
    eventId?: string;
    expiresAt: string;
  }>(`/api/tickets/verify/${ticketId}`);
  return response.data;
};

/**
 * 티켓 취소
 * @param ticketId 티켓 ID
 * @returns 성공 여부
 */
export const cancelTicket = async (ticketId: string): Promise<{ success: boolean }> => {
  const response = await ticketApi.delete<{ success: boolean }>(
    `/api/tickets/${ticketId}`
  );
  return response.data;
};

/**
 * 사용자 티켓 조회
 * @param userId 사용자 ID
 * @returns 티켓 목록
 */
export const getUserTickets = async (userId: string): Promise<{ tickets: Ticket[] }> => {
  const response = await ticketApi.get<{ tickets: Ticket[] }>(
    `/api/tickets/user/${userId}`
  );
  return response.data;
};
