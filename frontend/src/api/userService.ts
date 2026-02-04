import { userApi } from './client';
import { User } from '../types';

/**
 * 사용자 등록
 * @param username 사용자명
 * @param email 이메일
 * @returns 사용자 정보 및 세션 토큰
 */
export const registerUser = async (
  username: string,
  email: string
): Promise<User> => {
  const response = await userApi.post<User>('/api/users/register', {
    username,
    email,
  });
  return response.data;
};

/**
 * 사용자 인증 (세션 검증)
 * @returns 사용자 정보
 */
export const authenticateUser = async (): Promise<User> => {
  const response = await userApi.get<User>('/api/users/auth');
  return response.data;
};

/**
 * 사용자 정보 조회
 * @param userId 사용자 ID
 * @returns 사용자 정보
 */
export const getUserById = async (userId: string): Promise<User> => {
  const response = await userApi.get<User>(`/api/users/${userId}`);
  return response.data;
};
