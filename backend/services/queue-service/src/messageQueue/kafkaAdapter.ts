import { Kafka, Producer, Consumer, EachMessagePayload, Admin } from 'kafkajs';
import { QueueAdapter, QueueAdapterConfig, MessageHandler, PublishOptions } from './types';
import logger from '../utils/logger';

/**
 * Kafka Adapter
 * KafkaJS를 사용하여 Apache Kafka와 통신합니다.
 */
export class KafkaAdapter implements QueueAdapter {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;
  private admin: Admin | null = null;
  private isConnected: boolean = false;
  private brokers: string[];
  private clientId: string;
  private groupId: string;
  private subscribedTopics: Set<string> = new Set();

  constructor(config?: QueueAdapterConfig) {
    this.brokers = config?.brokers || 
      (process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092']);
    this.clientId = config?.clientId || process.env.KAFKA_CLIENT_ID || 'queue-service';
    this.groupId = process.env.KAFKA_GROUP_ID || 'queue-service-group';

    this.kafka = new Kafka({
      clientId: this.clientId,
      brokers: this.brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    logger.info('Kafka Adapter initialized', { 
      brokers: this.brokers,
      clientId: this.clientId,
      groupId: this.groupId
    });
  }

  /**
   * Kafka에 연결
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.producer) {
      return;
    }

    try {
      logger.info('Connecting to Kafka...');

      this.admin = this.kafka.admin();
      await this.admin.connect();

      this.producer = this.kafka.producer();
      await this.producer.connect();

      this.consumer = this.kafka.consumer({ groupId: this.groupId });
      await this.consumer.connect();

      this.isConnected = true;
      logger.info('Kafka connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Kafka', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }


  /**
   * Kafka 연결 해제
   */
  async disconnect(): Promise<void> {
    try {
      if (this.consumer) {
        await this.consumer.disconnect();
        this.consumer = null;
      }
      if (this.producer) {
        await this.producer.disconnect();
        this.producer = null;
      }
      if (this.admin) {
        await this.admin.disconnect();
        this.admin = null;
      }
      this.isConnected = false;
      this.subscribedTopics.clear();
      logger.info('Kafka disconnected');
    } catch (error) {
      logger.error('Error disconnecting from Kafka', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * 토픽 생성 (존재하지 않으면)
   */
  async createQueue(queueName: string): Promise<void> {
    await this.ensureConnected();

    try {
      const topics = await this.admin!.listTopics();
      
      if (!topics.includes(queueName)) {
        await this.admin!.createTopics({
          topics: [{
            topic: queueName,
            numPartitions: 1,
            replicationFactor: 1
          }]
        });
        logger.info('Kafka topic created', { topic: queueName });
      }
    } catch (error) {
      logger.warn('Failed to create Kafka topic (may already exist)', { 
        topic: queueName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 메시지 발행
   */
  async publish(queueName: string, message: unknown, options?: PublishOptions): Promise<void> {
    await this.ensureConnected();
    await this.createQueue(queueName);

    const messageValue = JSON.stringify(message);
    
    await this.producer!.send({
      topic: queueName,
      messages: [{
        value: messageValue,
        headers: options?.priority ? { priority: String(options.priority) } : undefined
      }]
    });

    logger.debug('Message published to Kafka', { topic: queueName, message });
  }


  /**
   * 메시지 구독
   */
  async subscribe(queueName: string, handler: MessageHandler): Promise<void> {
    await this.ensureConnected();
    await this.createQueue(queueName);

    if (this.subscribedTopics.has(queueName)) {
      logger.warn('Already subscribed to topic', { topic: queueName });
      return;
    }

    await this.consumer!.subscribe({ 
      topic: queueName, 
      fromBeginning: false 
    });
    
    this.subscribedTopics.add(queueName);

    await this.consumer!.run({
      eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
        if (topic !== queueName || !message.value) {
          return;
        }

        try {
          const content = JSON.parse(message.value.toString());
          
          logger.debug('Message received from Kafka', { topic, partition, content });

          // Kafka는 자동 커밋 사용, ack/nack는 로깅용
          const ack = async () => {
            logger.debug('Message acknowledged', { topic, partition });
          };

          const nack = async () => {
            logger.warn('Message processing failed', { topic, partition });
          };

          await handler(content, ack, nack);
        } catch (error) {
          logger.error('Error processing Kafka message', { 
            error: error instanceof Error ? error.message : 'Unknown error',
            topic 
          });
        }
      }
    });

    logger.info('Subscribed to Kafka topic', { topic: queueName });
  }

  /**
   * 토픽 메시지 수 조회 (근사치)
   */
  async getQueueSize(queueName: string): Promise<number> {
    await this.ensureConnected();

    try {
      const offsets = await this.admin!.fetchTopicOffsets(queueName);
      
      // 모든 파티션의 오프셋 합계
      const totalMessages = offsets.reduce((sum: number, partition: { high: string; low: string }) => {
        return sum + parseInt(partition.high, 10) - parseInt(partition.low, 10);
      }, 0);

      return totalMessages;
    } catch (error) {
      logger.warn('Failed to get Kafka topic size', { 
        topic: queueName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  /**
   * 연결 상태 확인 및 재연결
   */
  private async ensureConnected(): Promise<void> {
    if (!this.isConnected || !this.producer || !this.consumer) {
      await this.connect();
    }
  }
}
