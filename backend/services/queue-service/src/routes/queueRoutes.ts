import { Router } from 'express';
import QueueController from '../controllers/queueController';

const router = Router();

// 지연 초기화: Redis 연결 후 컨트롤러 생성
let queueController: QueueController | null = null;

function getController(): QueueController {
  if (!queueController) {
    queueController = new QueueController();
  }
  return queueController;
}

/**
 * Queue Service API 라우터
 * 요구사항 1.3: 대기열 생성, 조회, 삭제 기능
 */

// 큐 모드 조회 API
router.get('/mode', (req, res, next) => getController().getQueueMode(req, res, next));

// 로비 대기열 API
router.post('/lobby/join', (req, res, next) => getController().joinLobby(req, res, next));
router.get('/lobby/status', (req, res, next) => getController().getLobbyStatus(req, res, next));
router.get('/lobby/position/:userId', (req, res, next) => getController().getLobbyPosition(req, res, next));
router.delete('/lobby/leave/:userId', (req, res, next) => getController().leaveLobby(req, res, next));
router.post('/lobby/move-to-ticket', (req, res, next) => getController().moveToTicketQueue(req, res, next));

// 티케팅 이벤트 API (Advanced 모드)
router.get('/events', (req, res, next) => getController().getEvents(req, res, next));

// 티케팅별 대기열 API (Advanced 모드)
router.post('/ticket/join', (req, res, next) => getController().joinTicketQueue(req, res, next));
router.get('/ticket/:eventId/status', (req, res, next) => getController().getTicketQueueStatus(req, res, next));

export default router;
