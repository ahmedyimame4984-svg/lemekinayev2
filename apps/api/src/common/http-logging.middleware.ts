import { Injectable, type NestMiddleware, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class HttpLoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const { method } = req;
    const url = req.originalUrl || req.url;
    const startTime = Date.now();

    let errorDetails: string | undefined;

    // Capture response error body if response fails
    const originalSend = res.send.bind(res);
    res.send = (body?: unknown): Response => {
      if (res.statusCode >= 400 && body !== undefined && !errorDetails) {
        errorDetails = this.formatErrorBody(body);
      }
      return originalSend(body);
    };

    const originalJson = res.json?.bind(res);
    if (originalJson) {
      res.json = (body?: unknown): Response => {
        if (res.statusCode >= 400 && body !== undefined && !errorDetails) {
          errorDetails = this.formatErrorBody(body);
        }
        return originalJson(body);
      };
    }

    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      const { statusCode } = res;

      if (statusCode >= 400) {
        const detailSuffix = errorDetails ? ` - ${errorDetails}` : '';
        console.error(
          `[API Error] ${method} ${url} ${statusCode} (${durationMs}ms)${detailSuffix}`,
        );
      } else {
        console.log(
          `[API Success] ${method} ${url} ${statusCode} (${durationMs}ms)`,
        );
      }
    });

    res.on('close', () => {
      if (!res.writableEnded) {
        const durationMs = Date.now() - startTime;
        console.warn(
          `[API Aborted] ${method} ${url} (${durationMs}ms) - client closed connection`,
        );
      }
    });

    next();
  }

  private formatErrorBody(body: unknown): string {
    try {
      if (typeof body === 'string') {
        try {
          const parsed = JSON.parse(body) as unknown;
          return this.formatErrorBody(parsed);
        } catch {
          return this.sanitize(body.length > 300 ? `${body.slice(0, 300)}...` : body);
        }
      }

      if (typeof body === 'object' && body !== null) {
        if (Buffer.isBuffer(body)) {
          const str = body.toString('utf8');
          return this.sanitize(str.length > 300 ? `${str.slice(0, 300)}...` : str);
        }

        const obj = body as Record<string, unknown>;
        const code = typeof obj.code === 'string' ? `[${obj.code}] ` : '';
        let message = '';

        if (Array.isArray(obj.message)) {
          message = obj.message.join('; ');
        } else if (typeof obj.message === 'string') {
          message = obj.message;
        } else if (typeof obj.error === 'string') {
          message = obj.error;
        } else {
          message = JSON.stringify(obj);
        }

        const formatted = `${code}${message}`;
        return this.sanitize(
          formatted.length > 300 ? `${formatted.slice(0, 300)}...` : formatted,
        );
      }

      return this.sanitize(String(body));
    } catch {
      return 'Unable to serialize error response';
    }
  }

  private sanitize(text: string): string {
    return text.replace(
      /(password|token|secret|authorization|accessToken|refreshToken)[:=]\s*["']?[^"',\s}]+/gi,
      '$1: "***"',
    );
  }
}
