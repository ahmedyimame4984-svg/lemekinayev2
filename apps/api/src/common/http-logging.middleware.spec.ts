import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { Request, Response, NextFunction } from 'express';
import { HttpLoggingMiddleware } from './http-logging.middleware.js';

describe('HttpLoggingMiddleware', () => {
  let middleware: HttpLoggingMiddleware;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    middleware = new HttpLoggingMiddleware();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createMockContext(status = 200, method = 'GET', url = '/api/v1/test') {
    const req = {
      method,
      url,
      originalUrl: url,
    } as unknown as Request;

    const emitter = new EventEmitter();
    const res = Object.assign(emitter, {
      statusCode: status,
      writableEnded: false,
      send: vi.fn(function (body?: unknown) {
        return res;
      }),
      json: vi.fn(function (body?: unknown) {
        return res;
      }),
    }) as unknown as Response;

    const next: NextFunction = vi.fn();

    return { req, res, next, emitter };
  }

  it('logs successful API calls with console.log', () => {
    const { req, res, next, emitter } = createMockContext(200, 'GET', '/api/v1/catalog');

    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();

    res.statusCode = 200;
    (res as unknown as { writableEnded: boolean }).writableEnded = true;
    emitter.emit('finish');

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toMatch(/\[API Success\] GET \/api\/v1\/catalog 200 \(\d+ms\)/);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs client error API calls with console.error', () => {
    const { req, res, next, emitter } = createMockContext(400, 'POST', '/api/v1/auth/seller/login');

    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();

    res.statusCode = 400;
    res.send({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
    (res as unknown as { writableEnded: boolean }).writableEnded = true;
    emitter.emit('finish');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toMatch(
      /\[API Error\] POST \/api\/v1\/auth\/seller\/login 400 \(\d+ms\) - \[INVALID_CREDENTIALS\] Invalid email or password/,
    );
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs 500 server error calls with console.error', () => {
    const { req, res, next, emitter } = createMockContext(500, 'DELETE', '/api/v1/items/123');

    middleware.use(req, res, next);
    res.statusCode = 500;
    res.json({ message: 'Internal server error' });
    (res as unknown as { writableEnded: boolean }).writableEnded = true;
    emitter.emit('finish');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toMatch(/\[API Error\] DELETE \/api\/v1\/items\/123 500 \(\d+ms\) - Internal server error/);
  });

  it('handles array messages in validation errors and redacts sensitive data', () => {
    const { req, res, next, emitter } = createMockContext(422, 'POST', '/api/v1/users');

    middleware.use(req, res, next);
    res.statusCode = 422;
    res.send({
      code: 'VALIDATION_FAILED',
      message: ['name is required', 'password: supersecret123 is too short'],
    });
    (res as unknown as { writableEnded: boolean }).writableEnded = true;
    emitter.emit('finish');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const loggedMessage = errorSpy.mock.calls[0][0] as string;
    expect(loggedMessage).toContain('[VALIDATION_FAILED] name is required; password: "***"');
    expect(loggedMessage).not.toContain('supersecret123');
  });

  it('logs aborted client connections with console.warn', () => {
    const { req, res, next, emitter } = createMockContext(200, 'GET', '/api/v1/long-poll');

    middleware.use(req, res, next);
    (res as unknown as { writableEnded: boolean }).writableEnded = false;
    emitter.emit('close');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/\[API Aborted\] GET \/api\/v1\/long-poll \(\d+ms\) - client closed connection/);
  });
});
