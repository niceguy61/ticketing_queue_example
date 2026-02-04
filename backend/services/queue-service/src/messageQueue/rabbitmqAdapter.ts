import amqp from 'amqplib';
import { QueueAdapter, QueueAdapterConfig, MessageHandler, PublishOptions } from './types';
import logger from '../utils/logger';

/**
 * RabbitMQ Adapter
 * AMQP 프로토콜을 사용하여 RabbitMQ와 통신합니다.
 */
export class RabbitMQAdapter implements QueueAdapter {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private url: string;
  private isConnected: boolean = false;

  constructor(config?: QueueAdapterConfig) {
    this.url = config?.url || process.env.RABBITMQ_URL || 'amqp://admin:password@localhost:5672';
    
    logger.info('RabbitMQ Adapter initialized', { 
      url: this.url.replace(/:[^:@]+@/, ':****@') // 비밀번호 마스킹
    });
  }

  /**
   * RabbitMQ에 연결
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.connection && this.channel) {
      return;
    }

    try {
      logger.info('Connecting to RabbitMQ...');
      
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();
      this.isConnected = true;

      // 연결 이벤트 핸들링
      this.connection.connection.on('error', (err: Error) => {
        logger.error('RabbitMQ connection error', { error: err.message });
        this.isConnected = false;
      });

      this.connection.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.isConnected = false;
      });

      logger.info('RabbitMQ connected successfully');
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * RabbitMQ 연결 해제
   */
  async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      this.isConnected = false;
      logger.info('RabbitMQ disconnected');
    } catch (error) {
      logger.error('Error disconnecting from RabbitMQ', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * 큐 생성 (존재하지 않으면)
   */
  async createQueue(queueName: string): Promise<void> {
    await this.ensureConnected();
    
    await this.channel!.assertQueue(queueName, {
      durable: true, // 서버 재시작 시에도 큐 유지
      arguments: {
        'x-message-ttl': 86400000, // 메시지 TTL: 24시간
      }
    });
    
    logger.info('Queue created/asserted', { queueName });
  }

  /**
   * 메시지 발행
   */
  async publish(queueName: string, message: any, options?: PublishOptions): Promise<void> {
    await this.ensureConnected();

    // 큐가 존재하는지 확인
    await this.createQueue(queueName);

    const messageBuffer = Buffer.from(JSON.stringify(message));
    
    const publishOptions: amqp.Options.Publish = {
      persistent: true, // 메시지 영속성
      contentType: 'application/json',
    };

    if (options?.expiration) {
      publishOptions.expiration = options.expiration.toString();
    }

    if (options?.priority) {
      publishOptions.priority = options.priority;
    }

    const success = this.channel!.sendToQueue(queueName, messageBuffer, publishOptions);
    
    if (!success) {
      throw new Error('Failed to publish message to RabbitMQ');
    }

    logger.debug('Message published to RabbitMQ', { queueName, message });
  }

  /**
   * 메시지 구독
   */
  async subscribe(queueName: string, handler: MessageHandler): Promise<void> {
    await this.ensureConnected();

    // 큐가 존재하는지 확인
    await this.createQueue(queueName);

    // prefetch 설정 (한 번에 처리할 메시지 수)
    await this.channel!.prefetch(1);

    await this.channel!.consume(queueName, async (msg: amqp.ConsumeMessage | null) => {
      if (!msg) {
        return;
      }

      try {
        const content = JSON.parse(msg.content.toString());
        
        logger.debug('Message received from RabbitMQ', { queueName, content });

        // ack 함수: 메시지 처리 성공
        const ack = async () => {
          this.channel!.ack(msg);
        };

        // nack 함수: 메시지 처리 실패 (재시도)
        const nack = async () => {
          // requeue: true로 설정하면 큐의 맨 앞에 다시 추가
          // requeue: false로 설정하면 Dead Letter Queue로 이동 (설정된 경우)
          this.channel!.nack(msg, false, true);
        };

        await handler(content, ack, nack);
      } catch (error) {
        logger.error('Error processing RabbitMQ message', { 
          error: error instanceof Error ? error.message : 'Unknown error',
          queueName 
        });
        // 파싱 에러 등의 경우 메시지 버림
        this.channel!.nack(msg, false, false);
      }
    });

    logger.info('Subscribed to RabbitMQ queue', { queueName });
  }

  /**
   * 큐 크기 조회
   */
  async getQueueSize(queueName: string): Promise<number> {
    await this.ensureConnected();

    try {
      const queueInfo = await this.channel!.checkQueue(queueName);
      return queueInfo.messageCount;
    } catch (error) {
      // 큐가 존재하지 않는 경우
      return 0;
    }
  }

  /**
   * 연결 상태 확인 및 재연결
   */
  private async ensureConnected(): Promise<void> {
    if (!this.isConnected || !this.connection || !this.channel) {
      await this.connect();
    }
  }
}
