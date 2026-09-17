import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
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
// endpoint lain mengembalikan datanya apa adanya. Berkas biner dikirim apa
// adanya, tanpa envelope.
@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<
  T,
  SuccessEnvelope<T> | StreamableFile
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessEnvelope<T> | StreamableFile> {
    return next.handle().pipe(
      map((result) => {
        if (result instanceof StreamableFile) {
          return result;
        }
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
