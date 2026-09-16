import { HttpException } from '@nestjs/common';
import { ERROR_CODES, ErrorCode } from './error-codes';

export interface ErrorDetail {
  field: string;
  message: string;
}

export interface DomainErrorBody {
  code: ErrorCode;
  message: string;
  details?: ErrorDetail[];
}

// Error domain terkontrol — dipetakan ke envelope error oleh AllExceptionsFilter.
// planbackend.md §6.2, §6.3
export class DomainException extends HttpException {
  readonly code: ErrorCode;
  readonly details?: ErrorDetail[];

  constructor(
    code: ErrorCode,
    message?: string,
    details?: ErrorDetail[],
    status?: number,
  ) {
    const catalogEntry = ERROR_CODES[code];
    const body: DomainErrorBody = {
      code,
      message: message ?? catalogEntry.message,
      ...(details ? { details } : {}),
    };
    super(body, status ?? catalogEntry.status);
    this.code = code;
    this.details = details;
  }
}
