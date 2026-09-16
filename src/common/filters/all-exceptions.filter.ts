import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainException } from '../exceptions/domain.exception';
import { ERROR_CODES, ErrorCode } from '../exceptions/error-codes';

// Kode fallback untuk HttpException bawaan Nest/Passport yang tidak
// dilempar sebagai DomainException (mis. guard otorisasi di B2).
const SERVER_ERROR_THRESHOLD: number = HttpStatus.INTERNAL_SERVER_ERROR;

const STATUS_FALLBACK_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, code, message, details } = this.resolve(exception);

    if (status >= SERVER_ERROR_THRESHOLD) {
      this.logger.error(
        `${request.method} ${request.url} → ${status} ${code}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    });
  }

  private resolve(exception: unknown): {
    status: number;
    code: ErrorCode;
    message: string;
    details?: { field: string; message: string }[];
  } {
    if (exception instanceof DomainException) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        message: (exception.getResponse() as { message: string }).message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = STATUS_FALLBACK_CODE[status] ?? 'INTERNAL_ERROR';
      return {
        status,
        code,
        message: ERROR_CODES[code].message,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: ERROR_CODES.INTERNAL_ERROR.message,
    };
  }
}
