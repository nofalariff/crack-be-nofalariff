import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

// Batas atas dan bawah diperiksa di service agar kode errornya mengikuti
// katalog domain (VALIDATION_ERROR vs WEIGHT_EXCEEDS_LIMIT).
export class WeightCorrectionDto {
  @ApiProperty({ example: 12.4 })
  @IsNumber()
  actualWeight: number;

  @ApiPropertyOptional({ example: 'Hasil timbang ulang di gudang' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  })
  @IsString()
  notes?: string;
}
