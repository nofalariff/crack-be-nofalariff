import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

// serviceType & destinationCode sengaja tidak ada di sini — keduanya tidak
// dapat diubah setelah rute dibuat (mengikuti perilaku mock).
export class UpdateRouteDto {
  @ApiPropertyOptional({ example: 'Jawa Timur' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  })
  @IsString()
  destinationName?: string;

  @ApiPropertyOptional({ example: 'Jawa Timur' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  })
  @IsString()
  destinationRegion?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt({ message: 'Estimasi hari harus bilangan bulat' })
  @Min(1)
  @Max(30)
  estimatedDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
