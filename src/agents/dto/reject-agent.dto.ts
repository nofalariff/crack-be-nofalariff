import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';

// Panjang minimum divalidasi di service agar pesannya persis sama dengan
// kontrak frontend, termasuk saat alasan tidak dikirim sama sekali.
export class RejectAgentDto {
  @ApiProperty({ example: 'Dokumen perusahaan belum lengkap.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Alasan penolakan minimal 10 karakter.' })
  reason: string;
}
