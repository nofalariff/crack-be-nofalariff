import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';
import { normalizePhone } from '../../common/utils/phone.util';

// String kosong berarti "tidak diubah" (mengikuti perilaku mock frontend),
// kecuali `npwp` yang memakai string kosong untuk mengosongkan nilainya.
const trimOrUndefinedIfEmpty = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

const normalizePhoneOrUndefinedIfEmpty = ({
  value,
}: {
  value: unknown;
}): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  return normalizePhone(trimmed) ?? trimmed;
};

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Budi Santoso' })
  @IsOptional()
  @Transform(trimOrUndefinedIfEmpty)
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: '0812-3456-7890' })
  @IsOptional()
  @Transform(normalizePhoneOrUndefinedIfEmpty)
  @Matches(/^\+62\d{7,13}$/, {
    message: 'Format nomor HP tidak valid. Contoh: 0812-3456-7890',
  })
  phone?: string;

  @ApiPropertyOptional({ example: 'PT Kargo Nusantara' })
  @IsOptional()
  @Transform(trimOrUndefinedIfEmpty)
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: 'Jl. Pelabuhan No. 10, Makassar' })
  @IsOptional()
  @Transform(trimOrUndefinedIfEmpty)
  @IsString()
  companyAddress?: string;

  @ApiPropertyOptional({ example: 'Siti Aminah' })
  @IsOptional()
  @Transform(trimOrUndefinedIfEmpty)
  @IsString()
  picName?: string;

  @ApiPropertyOptional({ example: '0813-1111-2222' })
  @IsOptional()
  @Transform(normalizePhoneOrUndefinedIfEmpty)
  @Matches(/^\+62\d{7,13}$/, {
    message: 'Format nomor HP tidak valid. Contoh: 0812-3456-7890',
  })
  picPhone?: string;

  @ApiPropertyOptional({
    description: 'Kirim string kosong untuk mengosongkan NPWP',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  npwp?: string;
}
