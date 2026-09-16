import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginationMeta } from '../dto/pagination-meta';

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

// Membungkus seluruh response sukses ke bentuk envelope — planbackend.md §6.2.
// Endpoint daftar mengembalikan { data, meta } dan meta akan diangkat ke luar;
// endpoint lain mengembalikan datanya apa adanya.
@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<
  T,
  SuccessEnvelope<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessEnvelope<T>> {
    return next.handle().pipe(
      map((result) => {
        if (isPaginatedResult<T>(result)) {
          return { success: true, data: result.data, meta: result.meta };
        }
        return { success: true, data: result };
      }),
    );
  }
}

function isPaginatedResult<T>(
  value: unknown,
): value is { data: T; meta: PaginationMeta } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'meta' in value
  );
}
