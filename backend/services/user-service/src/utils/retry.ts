/**
 * 재시도 로직 유틸리티
 * 요구사항 1.2: 서비스 간 통신 재시도
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN']
};

/**
 * 재시도 가능한 에러인지 확인
 */
function isRetryableError(error: any, retryableErrors: string[]): boolean {
  if (!error) return false;
  
  // 네트워크 에러
  if (error.code && retryableErrors.includes(error.code)) {
    return true;
  }
  
  // HTTP 5xx 에러
  if (error.response && error.response.status >= 500) {
    return true;
  }
  
  // 타임아웃 에러
  if (error.message && error.message.toLowerCase().includes('timeout')) {
    return true;
  }
  
  return false;
}

/**
 * Exponential backoff를 사용한 재시도 로직
 * 
 * @param fn 실행할 함수
 * @param options 재시도 옵션
 * @returns 함수 실행 결과
 * @throws 최대 재시도 횟수 초과 시 마지막 에러
 * 
 * @example
 * const result = await retryWithBackoff(
 *   () => databaseQuery(),
 *   { maxRetries: 3, initialDelayMs: 1000 }
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;
  let delayMs = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // 재시도 가능한 에러인지 확인
      if (!isRetryableError(error, opts.retryableErrors)) {
        throw error;
      }

      // 마지막 시도였다면 에러 던지기
      if (attempt === opts.maxRetries) {
        throw error;
      }

      // 대기 후 재시도
      await new Promise(resolve => setTimeout(resolve, delayMs));

      // Exponential backoff
      delayMs = Math.min(delayMs * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * 조건부 재시도 로직
 * 
 * @param fn 실행할 함수
 * @param shouldRetry 재시도 여부를 결정하는 함수
 * @param options 재시도 옵션
 * @returns 함수 실행 결과
 * 
 * @example
 * const result = await retryWithCondition(
 *   () => externalService.call(),
 *   (error) => error.message.includes('temporary'),
 *   { maxRetries: 5 }
 * );
 */
export async function retryWithCondition<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: any) => boolean,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;
  let delayMs = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // 커스텀 조건으로 재시도 여부 결정
      if (!shouldRetry(error)) {
        throw error;
      }

      // 마지막 시도였다면 에러 던지기
      if (attempt === opts.maxRetries) {
        throw error;
      }

      // 대기 후 재시도
      await new Promise(resolve => setTimeout(resolve, delayMs));

      // Exponential backoff
      delayMs = Math.min(delayMs * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * 타임아웃과 함께 재시도
 * 
 * @param fn 실행할 함수
 * @param timeoutMs 타임아웃 시간 (밀리초)
 * @param options 재시도 옵션
 * @returns 함수 실행 결과
 * 
 * @example
 * const result = await retryWithTimeout(
 *   () => externalService.call(),
 *   5000, // 5초 타임아웃
 *   { maxRetries: 3 }
 * );
 */
export async function retryWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  options: RetryOptions = {}
): Promise<T> {
  return retryWithBackoff(async () => {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
      )
    ]);
  }, options);
}
