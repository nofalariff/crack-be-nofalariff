import { ApiProperty } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CalculateRateDto {
  @ApiProperty({ enum: ServiceType })
  @IsEnum(ServiceType, { message: 'Pilih jenis layanan' })
  serviceType: ServiceType;

  @ApiProperty({ example: 'JATIM' })
  @IsString()
  @IsNotEmpty({ message: 'Pilih tujuan pengiriman' })
  destinationCode: string;

  @ApiProperty({ example: 4.5 })
  @IsNumber()
  weight: number;
}
