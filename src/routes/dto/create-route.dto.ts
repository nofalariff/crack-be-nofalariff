import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRouteDto {
  @ApiProperty({ enum: ServiceType })
  @IsEnum(ServiceType, { message: 'Pilih jenis layanan' })
  serviceType: ServiceType;

  @ApiProperty({ example: 'JATIM' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(2, { message: 'Kode tujuan minimal 2 karakter' })
  @MaxLength(20, { message: 'Kode tujuan maksimal 20 karakter' })
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'Kode tujuan hanya boleh huruf, angka, dan garis bawah',
  })
  destinationCode: string;

  @ApiProperty({ example: 'Jawa Timur' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2, { message: 'Nama tujuan wajib diisi' })
  destinationName: string;

  @ApiProperty({ example: 'Jawa Timur' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2, { message: 'Wilayah wajib diisi' })
  destinationRegion: string;

  @ApiProperty({ example: 3 })
  @IsInt({ message: 'Estimasi hari harus bilangan bulat' })
  @Min(1)
  @Max(30)
  estimatedDays: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
