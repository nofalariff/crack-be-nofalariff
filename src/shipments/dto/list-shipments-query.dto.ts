import { ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceType, ShipmentStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const trimOrSkipIfEmpty = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class ListShipmentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ShipmentStatus })
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @ApiPropertyOptional({ enum: ServiceType })
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @ApiPropertyOptional({ description: 'Nomor resi atau nama penerima' })
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @IsString()
  search?: string;

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
