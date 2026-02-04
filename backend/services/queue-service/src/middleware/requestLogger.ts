import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * 요청 로깅 미들웨어
 * 요구사항 10.3: 요청 처리 시간 로깅
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // 응답 완료 시 로깅
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  });

  next();
};
