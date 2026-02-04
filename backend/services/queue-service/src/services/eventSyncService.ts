import dbConnection from '../database/connection';
import QueueConfigManager, { TicketEventConfig } from '../queue/queueConfig';
import logger from '../utils/logger';

/**
 * DB 이벤트 인터페이스
 */
interface DBEvent {
  event_id: string;
  name: string;
  description: string | null;
  venue: string | null;
  event_date: Date;
  total_seats: number;
  available_seats: number;
  price: number;
  status: string;
}

/**
 * DB에서 이벤트를 읽어 Redis에 동기화하는 서비스
 */
export class EventSyncService {
  private configManager: QueueConfigManager;

  constructor() {
    this.configManager = new QueueConfigManager();
  }

  /**
   * DB에서 활성 이벤트 조회
   */
  async getActiveEventsFromDB(): Promise<DBEvent[]> {
    try {
      const events = await dbConnection.query<DBEvent>(
        `SELECT event_id, name, description, venue, event_date, 
                total_seats, available_seats, price, status 
         FROM events 
         WHERE status = 'active'
         ORDER BY event_date ASC`
      );
      return events;
    } catch (error) {
      logger.error('Failed to fetch events from database', { error });
      return [];
    }
  }

  /**
   * DB 이벤트를 Redis 티켓 이벤트 설정으로 변환
   */
  private convertToTicketEventConfig(event: DBEvent): TicketEventConfig {
    return {
      name: event.name,
      capacity: event.total_seats,
      processingRate: parseInt(process.env.PROCESSING_RATE || '10', 10)
    };
  }

  /**
   * DB 이벤트를 Redis에 동기화
   */
  async syncEventsToRedis(): Promise<void> {
    try {
      logger.info('Starting event synchronization from DB to Redis...');

      // DB에서 활성 이벤트 조회
      const dbEvents = await this.getActiveEventsFromDB();
      
      if (dbEvents.length === 0) {
        logger.warn('No active events found in database');
        return;
      }

      // 현재 Redis의 티켓 이벤트 조회
      const currentEvents = await this.configManager.getAllTicketEvents();

      // DB 이벤트를 Redis에 추가/업데이트
      for (const event of dbEvents) {
        const eventConfig = this.convertToTicketEventConfig(event);
        
        // 이미 존재하는지 확인
        const existingConfig = currentEvents[event.event_id];
        
        if (!existingConfig || 
            existingConfig.name !== eventConfig.name || 
            existingConfig.capacity !== eventConfig.capacity) {
          await this.configManager.addTicketEvent(event.event_id, eventConfig);
          logger.info('Event synced to Redis', { 
            eventId: event.event_id, 
            name: eventConfig.name,
            capacity: eventConfig.capacity 
          });
        }
      }

      logger.info('Event synchronization completed', { 
        syncedCount: dbEvents.length 
      });

    } catch (error) {
      logger.error('Failed to sync events to Redis', { error });
      throw error;
    }
  }
}

export default EventSyncService;
