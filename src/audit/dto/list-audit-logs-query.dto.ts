import { ApiPropertyOptional } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const trimOrSkipIfEmpty = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class ListAuditLogsQueryDto extends PaginationQueryDto {
  // Riwayat audit memakai halaman lebih panjang dari daftar lain.
  @ApiPropertyOptional({ default: 30, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return 30;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 30;
  })
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 30;

  @ApiPropertyOptional({ enum: AuditAction })
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @IsISO8601()
  dateTo?: string;
}
