import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
  CreateQueueCommand
} from '@aws-sdk/client-sqs';
import { QueueAdapter, MessageHandler, PublishOptions, QueueAdapterConfig } from './types';
import logger from '../utils/logger';

/**
 * AWS SQS Adapter
 * LocalStack과 실제 AWS SQS를 모두 지원합니다.
 */
export class SQSAdapter implements QueueAdapter {
  private client: SQSClient;
  private queueUrls: Map<string, string> = new Map();
  private isPolling: boolean = false;
  private pollingAbortControllers: Map<string, AbortController> = new Map();

  constructor(config: QueueAdapterConfig = {}) {
    const region = config.region || process.env.AWS_REGION || 'us-east-1';
    const endpoint = config.endpoint || process.env.AWS_ENDPOINT;

    this.client = new SQSClient({
      region,
      endpoint,
      credentials: endpoint ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
      } : undefined
    });

    logger.info('SQS Adapter initialized', { region, endpoint: endpoint || 'default' });
  }

  async connect(): Promise<void> {
    // SQS는 연결 개념이 없으므로 간단한 헬스 체크만 수행
    try {
      // 테스트 큐 URL 조회 시도 (존재하지 않아도 OK)
      await this.client.send(new GetQueueUrlCommand({ QueueName: 'health-check' }))
        .catch(() => {
          // 큐가 없어도 연결은 정상
        });
      logger.info('SQS Adapter connected');
    } catch (error) {
      logger.error('Failed to connect to SQS', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // 모든 폴링 중단
    this.isPolling = false;
    for (const controller of this.pollingAbortControllers.values()) {
      controller.abort();
    }
    this.pollingAbortControllers.clear();
    
    this.client.destroy();
    logger.info('SQS Adapter disconnected');
  }

  async publish(queueName: string, message: any, options?: PublishOptions): Promise<void> {
    try {
      const queueUrl = await this.getQueueUrl(queueName);
      
      await this.client.send(new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(message),
        DelaySeconds: options?.delay ? Math.floor(options.delay / 1000) : undefined
      }));

      logger.debug('Message published to SQS', { queueName, messageId: message.userId });
    } catch (error) {
      logger.error('Failed to publish message to SQS', { queueName, error });
      throw error;
    }
  }

  async subscribe(queueName: string, handler: MessageHandler): Promise<void> {
    const queueUrl = await this.getQueueUrl(queueName);
    this.isPolling = true;

    const abortController = new AbortController();
    this.pollingAbortControllers.set(queueName, abortController);

    logger.info('Started SQS polling', { queueName });

    const pollMessages = async () => {
      while (this.isPolling && !abortController.signal.aborted) {
        try {
          const response = await this.client.send(new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20, // Long polling
            VisibilityTimeout: 30
          }));

          if (response.Messages && response.Messages.length > 0) {
            logger.debug('Received messages from SQS', { 
              queueName, 
              count: response.Messages.length 
            });

            for (const msg of response.Messages) {
              try {
                const content = JSON.parse(msg.Body!);
                
                await handler(
                  content,
                  // ack: 메시지 삭제
                  async () => {
                    await this.client.send(new DeleteMessageCommand({
                      QueueUrl: queueUrl,
                      ReceiptHandle: msg.ReceiptHandle
                    }));
                    logger.debug('Message acknowledged', { queueName });
                  },
                  // nack: 가시성 타임아웃 리셋 (재시도)
                  async () => {
                    await this.client.send(new ChangeMessageVisibilityCommand({
                      QueueUrl: queueUrl,
                      ReceiptHandle: msg.ReceiptHandle,
                      VisibilityTimeout: 0
                    }));
                    logger.debug('Message nacked for retry', { queueName });
                  }
                );
              } catch (error) {
                logger.error('Error processing SQS message', { queueName, error });
              }
            }
          }
        } catch (error) {
          if (!abortController.signal.aborted) {
            logger.error('Error polling SQS', { queueName, error });
            // 에러 발생 시 잠시 대기 후 재시도
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      }
    };

    // 폴링 시작 (백그라운드)
    pollMessages().catch(error => {
      logger.error('Fatal error in SQS polling', { queueName, error });
    });
  }

  async getQueueSize(queueName: string): Promise<number> {
    try {
      const queueUrl = await this.getQueueUrl(queueName);
      
      const response = await this.client.send(new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ['ApproximateNumberOfMessages']
      }));

      return parseInt(response.Attributes?.ApproximateNumberOfMessages ?? '0');
    } catch (error) {
      logger.error('Failed to get SQS queue size', { queueName, error });
      return 0;
    }
  }

  async createQueue(queueName: string): Promise<void> {
    try {
      const response = await this.client.send(new CreateQueueCommand({
        QueueName: queueName,
        Attributes: {
          VisibilityTimeout: '30',
          MessageRetentionPeriod: '86400', // 1일
          ReceiveMessageWaitTimeSeconds: '20' // Long polling
        }
      }));

      if (response.QueueUrl) {
        this.queueUrls.set(queueName, response.QueueUrl);
        logger.info('SQS queue created', { queueName, queueUrl: response.QueueUrl });
      }
    } catch (error: any) {
      // 큐가 이미 존재하는 경우 무시
      if (error.name === 'QueueAlreadyExists') {
        logger.debug('SQS queue already exists', { queueName });
        await this.getQueueUrl(queueName); // URL 캐시
      } else {
        logger.error('Failed to create SQS queue', { queueName, error });
        throw error;
      }
    }
  }

  /**
   * 큐 URL 조회 (캐시 사용)
   */
  private async getQueueUrl(queueName: string): Promise<string> {
    if (this.queueUrls.has(queueName)) {
      return this.queueUrls.get(queueName)!;
    }

    try {
      const response = await this.client.send(new GetQueueUrlCommand({
        QueueName: queueName
      }));

      if (response.QueueUrl) {
        this.queueUrls.set(queueName, response.QueueUrl);
        return response.QueueUrl;
      }

      throw new Error(`Queue URL not found for ${queueName}`);
    } catch (error: any) {
      if (error.name === 'QueueDoesNotExist') {
        // 큐가 없으면 자동 생성
        await this.createQueue(queueName);
        return this.getQueueUrl(queueName);
      }
      throw error;
    }
  }
}
