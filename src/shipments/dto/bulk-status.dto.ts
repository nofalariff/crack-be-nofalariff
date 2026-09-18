import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShipmentStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class BulkStatusDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty({ message: 'Pilih minimal satu kiriman' })
  @ArrayMaxSize(100, { message: 'Maksimal 100 kiriman per aksi massal' })
  @IsString({ each: true })
  shipmentIds: string[];

  @ApiProperty({ enum: ShipmentStatus })
  @IsEnum(ShipmentStatus, { message: 'Status kiriman tidak dikenal' })
  status: ShipmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  })
  @IsString()
  notes?: string;
}
