import { ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceType, ShipmentStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';

const trimOrSkipIfEmpty = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class ManifestQueryDto {
  @ApiPropertyOptional({ example: 'UPG' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() !== ''
      ? value.trim().toUpperCase()
      : undefined,
  )
  @IsString()
  destinationCode?: string;

  @ApiPropertyOptional({ enum: ServiceType })
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @ApiPropertyOptional({
    enum: ShipmentStatus,
    description: 'Bawaan: kiriman yang siap berangkat dari gudang',
  })
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

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
