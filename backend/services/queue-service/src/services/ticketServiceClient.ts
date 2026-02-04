import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';

/**
 * Ticket Service 클라이언트
 * 티켓 발급을 위한 내부 API 호출
 * 요구사항 1.2: 재시도 로직 포함
 */
export class TicketServiceClient {
  private client: AxiosInstance;
  private readonly baseURL: string;

  constructor() {
    this.baseURL = process.env.TICKET_SERVICE_URL || 'http://localhost:3002';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * 티켓 발급 요청 (재시도 로직 포함)
   * @param userId 사용자 ID
   * @param eventId 이벤트 ID (선택적)
   * @returns 발급된 티켓 정보
   */
  async issueTicket(userId: string, eventId?: string): Promise<TicketResponse> {
    try {
      // Exponential backoff를 사용한 재시도
      const response = await retryWithBackoff(
        async () => {
          return await this.client.post<TicketResponse>('/api/tickets/issue', {
            userId,
            eventId
          });
        },
        {
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 5000,
          backoffMultiplier: 2
        }
      );

      logger.info('Ticket issued successfully', { 
        userId, 
        ticketId: response.data.ticketId 
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to issue ticket after retries', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * 헬스 체크
   * @returns Ticket Service 상태
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

/**
 * 티켓 응답 인터페이스
 */
export interface TicketResponse {
  ticketId: string;
  userId: string;
  eventId?: string;
  issuedAt: string;
  expiresAt: string;
  status: string;
}

export default TicketServiceClient;
