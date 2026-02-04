/**
 * Message Queue 타입 정의
 */

/**
 * 메시지 핸들러 함수
 * @param message 수신한 메시지
 * @param ack 메시지 처리 성공 확인 함수
 * @param nack 메시지 처리 실패 (재시도) 함수
 */
export type MessageHandler = (
  message: any,
  ack: () => Promise<void>,
  nack: () => Promise<void>
) => Promise<void>;

/**
 * 메시지 발행 옵션
 */
export interface PublishOptions {
  /** 메시지 지연 시간 (밀리초) */
  delay?: number;
  /** 메시지 우선순위 */
  priority?: number;
  /** 메시지 만료 시간 (밀리초) */
  expiration?: number;
}

/**
 * Queue Adapter 설정
 */
export interface QueueAdapterConfig {
  /** 연결 URL 또는 엔드포인트 */
  url?: string;
  /** AWS 리전 (SQS용) */
  region?: string;
  /** AWS 엔드포인트 (LocalStack용) */
  endpoint?: string;
  /** Kafka 브로커 목록 */
  brokers?: string[];
  /** 클라이언트 ID */
  clientId?: string;
  /** 폴링 간격 (밀리초, Redis용) */
  pollIntervalMs?: number;
}

/**
 * Queue Adapter 인터페이스
 * 다양한 메시지 큐 구현체를 추상화합니다.
 */
export interface QueueAdapter {
  /**
   * 메시지 큐에 연결
   */
  connect(): Promise<void>;

  /**
   * 메시지 큐 연결 해제
   */
  disconnect(): Promise<void>;

  /**
   * 메시지 발행
   * @param queueName 큐 이름
   * @param message 발행할 메시지
   * @param options 발행 옵션
   */
  publish(queueName: string, message: any, options?: PublishOptions): Promise<void>;

  /**
   * 메시지 구독
   * @param queueName 큐 이름
   * @param handler 메시지 핸들러
   */
  subscribe(queueName: string, handler: MessageHandler): Promise<void>;

  /**
   * 큐 크기 조회
   * @param queueName 큐 이름
   * @returns 큐에 있는 메시지 수
   */
  getQueueSize(queueName: string): Promise<number>;

  /**
   * 큐 생성 (필요한 경우)
   * @param queueName 큐 이름
   */
  createQueue?(queueName: string): Promise<void>;
}
