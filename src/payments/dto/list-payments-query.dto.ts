import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentRecordStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export const PAYMENT_QUEUE_STATUSES = [
  'WAITING_VERIFICATION',
  'VERIFIED',
  'REJECTED',
  'ALL',
] as const;

export type PaymentQueueStatus = PaymentRecordStatus | 'ALL';

export class ListPaymentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: PAYMENT_QUEUE_STATUSES,
    default: 'WAITING_VERIFICATION',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  })
  @IsIn(PAYMENT_QUEUE_STATUSES)
  status?: PaymentQueueStatus;
}
