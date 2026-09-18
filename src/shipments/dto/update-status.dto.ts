import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShipmentStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

const trimOrSkipIfEmpty = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

// deliveredTo dan reason divalidasi di state machine, bukan di sini, agar
// penolakannya memakai kode domain SHIPMENT_INVALID_TRANSITION (§7.3).
export class UpdateStatusDto {
  @ApiProperty({ enum: ShipmentStatus })
  @IsEnum(ShipmentStatus, { message: 'Status kiriman tidak dikenal' })
  status: ShipmentStatus;

  @ApiPropertyOptional({ example: 'Pelabuhan Makassar' })
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Wajib saat status DELIVERED' })
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @IsString()
  deliveredTo?: string;

  @ApiPropertyOptional({
    description: 'Wajib saat status ON_HOLD atau CANCELLED',
  })
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @IsString()
  reason?: string;
}
