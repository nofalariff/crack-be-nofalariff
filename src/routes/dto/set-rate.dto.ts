import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class SetRateDto {
  @ApiProperty({ example: 16_000 })
  @IsInt()
  pricePerKg: number;

  @ApiProperty({ example: 3 })
  @IsInt()
  minChargeableWeight: number;

  @ApiProperty({ example: 10_000 })
  @IsInt()
  @Min(0, { message: 'Biaya dasar tidak boleh negatif' })
  baseFee: number;
}
