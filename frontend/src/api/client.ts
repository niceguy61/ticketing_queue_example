import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { config } from '../config';

/**
 * Axios 인스턴스 생성 헬퍼
 * @param baseURL 기본 URL
 * @returns 설정된 Axios 인스턴스
 */
const createApiClient = (baseURL: string): AxiosInstance => {
  const client = axios.create({
    baseURL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // 요청 인터셉터 - 인증 토큰 추가
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = localStorage.getItem('sessionToken');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // 응답 인터셉터 - 에러 처리
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response) {
        // 서버가 응답을 반환한 경우
        const status = error.response.status;
        const data = error.response.data as any;

        switch (status) {
          case 400:
            console.error('Bad Request:', data.message);
            break;
          case 401:
            console.error('Unauthorized:', data.message);
            // 세션 만료 처리
            localStorage.removeItem('sessionToken');
            localStorage.removeItem('userId');
            window.location.href = '/register';
            break;
          case 404:
            console.error('Not Found:', data.message);
            break;
          case 409:
            console.error('Conflict:', data.message);
            break;
          case 429:
            console.error('Too Many Requests:', data.message);
            break;
          case 500:
          case 503:
            console.error('Server Error:', data.message);
            break;
          default:
            console.error('API Error:', data.message);
        }

        return Promise.reject({
          status,
          message: data.message || 'An error occurred',
          error: data.error,
        });
      } else if (error.request) {
        // 요청은 보냈지만 응답을 받지 못한 경우
        console.error('No response received:', error.message);
        return Promise.reject({
          status: 0,
          message: '서버에 연결할 수 없습니다.',
          error: 'Network Error',
        });
      } else {
        // 요청 설정 중 에러 발생
        console.error('Request setup error:', error.message);
        return Promise.reject({
          status: 0,
          message: '요청 처리 중 오류가 발생했습니다.',
          error: error.message,
        });
      }
    }
  );

  return client;
};

// 각 서비스별 API 클라이언트
export const queueApi = createApiClient(config.queueServiceUrl);
export const ticketApi = createApiClient(config.ticketServiceUrl);
export const userApi = createApiClient(config.userServiceUrl);
