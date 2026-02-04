import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import redisConnection from '../redis/connection';
import QueueConfigManager, { QueueConfig, TicketEventConfig } from './queueConfig';

describe('Queue Config Manager', () => {
  let configManager: QueueConfigManager;

  beforeAll(async () => {
    await redisConnection.connect();
    configManager = new QueueConfigManager();
  });

  afterAll(async () => {
    await redisConnection.disconnect();
  });

  beforeEach(async () => {
    // Clean up config before each test
    await configManager.clearConfig();
  });

  describe('saveConfig and getConfig', () => {
    it('should save and retrieve config', async () => {
      const config: QueueConfig = {
        mode: 'simple',
        lobbyCapacity: 500,
        processingRate: 5
      };

      await configManager.saveConfig(config);
      const retrieved = await configManager.getConfig();

      expect(retrieved).not.toBeNull();
      expect(retrieved?.mode).toBe('simple');
      expect(retrieved?.lobbyCapacity).toBe(500);
      expect(retrieved?.processingRate).toBe(5);
    });

    it('should save config with ticket events', async () => {
      const config: QueueConfig = {
        mode: 'advanced',
        lobbyCapacity: 1000,
        processingRate: 10,
        ticketEvents: {
          'event-1': {
            name: 'Concert A',
            capacity: 100,
            processingRate: 5
          }
        }
      };

      await configManager.saveConfig(config);
      const retrieved = await configManager.getConfig();

      expect(retrieved?.ticketEvents).toBeDefined();
      expect(retrieved?.ticketEvents?.['event-1'].name).toBe('Concert A');
    });

    it('should return null for non-existent config', async () => {
      const config = await configManager.getConfig();
      expect(config).toBeNull();
    });
  });

  describe('setMode and getMode', () => {
    it('should set and get mode', async () => {
      await configManager.initializeDefaultConfig();
      await configManager.setMode('advanced');

      const mode = await configManager.getMode();
      expect(mode).toBe('advanced');
    });

    it('should return default mode when not set', async () => {
      const mode = await configManager.getMode();
      expect(mode).toBe('simple');
    });
  });

  describe('setLobbyCapacity and getLobbyCapacity', () => {
    it('should set and get lobby capacity', async () => {
      await configManager.initializeDefaultConfig();
      await configManager.setLobbyCapacity(2000);

      const capacity = await configManager.getLobbyCapacity();
      expect(capacity).toBe(2000);
    });

    it('should return default capacity when not set', async () => {
      const capacity = await configManager.getLobbyCapacity();
      expect(capacity).toBe(1000);
    });
  });

  describe('setProcessingRate and getProcessingRate', () => {
    it('should set and get processing rate', async () => {
      await configManager.initializeDefaultConfig();
      await configManager.setProcessingRate(20);

      const rate = await configManager.getProcessingRate();
      expect(rate).toBe(20);
    });

    it('should return default rate when not set', async () => {
      const rate = await configManager.getProcessingRate();
      expect(rate).toBe(10);
    });
  });

  describe('Ticket Events (Advanced Mode)', () => {
    beforeEach(async () => {
      await configManager.initializeDefaultConfig();
      await configManager.setMode('advanced');
    });

    it('should add ticket event', async () => {
      const eventConfig: TicketEventConfig = {
        name: 'Concert A',
        capacity: 100,
        processingRate: 5
      };

      await configManager.addTicketEvent('event-1', eventConfig);
      const retrieved = await configManager.getTicketEvent('event-1');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('Concert A');
      expect(retrieved?.capacity).toBe(100);
    });

    it('should remove ticket event', async () => {
      const eventConfig: TicketEventConfig = {
        name: 'Concert A',
        capacity: 100,
        processingRate: 5
      };

      await configManager.addTicketEvent('event-1', eventConfig);
      await configManager.removeTicketEvent('event-1');

      const retrieved = await configManager.getTicketEvent('event-1');
      expect(retrieved).toBeNull();
    });

    it('should get all ticket events', async () => {
      const event1: TicketEventConfig = {
        name: 'Concert A',
        capacity: 100,
        processingRate: 5
      };

      const event2: TicketEventConfig = {
        name: 'Concert B',
        capacity: 200,
        processingRate: 10
      };

      await configManager.addTicketEvent('event-1', event1);
      await configManager.addTicketEvent('event-2', event2);

      const allEvents = await configManager.getAllTicketEvents();
      expect(Object.keys(allEvents).length).toBe(2);
      expect(allEvents['event-1'].name).toBe('Concert A');
      expect(allEvents['event-2'].name).toBe('Concert B');
    });

    it('should return empty object when no events exist', async () => {
      const allEvents = await configManager.getAllTicketEvents();
      expect(allEvents).toEqual({});
    });
  });

  describe('initializeDefaultConfig', () => {
    it('should initialize with default values', async () => {
      await configManager.initializeDefaultConfig();
      const config = await configManager.getConfig();

      expect(config).not.toBeNull();
      expect(config?.mode).toBeDefined();
      expect(config?.lobbyCapacity).toBeGreaterThan(0);
      expect(config?.processingRate).toBeGreaterThan(0);
    });
  });

  describe('configExists', () => {
    it('should return false when config does not exist', async () => {
      const exists = await configManager.configExists();
      expect(exists).toBe(false);
    });

    it('should return true when config exists', async () => {
      await configManager.initializeDefaultConfig();
      const exists = await configManager.configExists();
      expect(exists).toBe(true);
    });
  });

  describe('clearConfig', () => {
    it('should clear config', async () => {
      await configManager.initializeDefaultConfig();
      await configManager.clearConfig();

      const exists = await configManager.configExists();
      expect(exists).toBe(false);
    });
  });
});
