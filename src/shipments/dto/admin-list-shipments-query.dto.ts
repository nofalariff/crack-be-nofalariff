import { ApiPropertyOptional } from '@nestjs/swagger';
import { ShipmentPaymentStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ListShipmentsQueryDto } from './list-shipments-query.dto';

const trimOrSkipIfEmpty = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class AdminListShipmentsQueryDto extends ListShipmentsQueryDto {
  @ApiPropertyOptional({ example: 'JATIM' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() !== ''
      ? value.trim().toUpperCase()
      : undefined,
  )
  @IsString()
  destinationCode?: string;

  @ApiPropertyOptional({ enum: ShipmentPaymentStatus })
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @IsEnum(ShipmentPaymentStatus)
  paymentStatus?: ShipmentPaymentStatus;
}
