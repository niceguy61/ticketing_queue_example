import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * 커스텀 에러 클래스
 */
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class QueueFullError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueueFullError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

/**
 * Express 에러 핸들러 미들웨어
 * 요구사항 9.3, 10.2: 에러 처리 및 로깅
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // 에러 로깅
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // 클라이언트 응답
  if (err instanceof ValidationError) {
    res.status(400).json({
      error: 'Bad Request',
      message: err.message,
      field: err.field,
      statusCode: 400
    });
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({
      error: 'Not Found',
      message: err.message,
      statusCode: 404
    });
    return;
  }

  if (err instanceof QueueFullError) {
    res.status(429).json({
      error: 'Queue Full',
      message: err.message,
      statusCode: 429,
      retryAfter: 60
    });
    return;
  }

  if (err instanceof ConflictError) {
    res.status(409).json({
      error: 'Conflict',
      message: err.message,
      statusCode: 409
    });
    return;
  }

  // 기본 서버 에러
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    statusCode: 500
  });
};
