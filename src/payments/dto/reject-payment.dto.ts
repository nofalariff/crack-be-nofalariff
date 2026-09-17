import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';

// Panjang minimum alasan divalidasi di service agar pesannya persis sama
// dengan kontrak frontend, termasuk saat alasan tidak dikirim sama sekali.
export class RejectPaymentDto {
  @ApiProperty({ example: 'Nominal transfer tidak sesuai tagihan.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Alasan penolakan minimal 10 karakter.' })
  reason: string;
}
