import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { normalizePhone } from '../../common/utils/phone.util';

// label & postalCode memakai string kosong untuk mengosongkan nilainya;
// field lain mengabaikan string kosong (mengikuti perilaku mock frontend).
const trimOrSkipIfEmpty = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

const keepEmpty = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateRecipientDto {
  @ApiPropertyOptional({
    description: 'Kirim string kosong untuk mengosongkan',
  })
  @IsOptional()
  @Transform(keepEmpty)
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @MinLength(3, { message: 'Nama penerima minimal 3 karakter' })
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    return normalizePhone(trimmed) ?? trimmed;
  })
  @Matches(/^\+62\d{7,13}$/, {
    message: 'Format nomor HP tidak valid. Contoh: 0812-3456-7890',
  })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @MinLength(5, { message: 'Alamat minimal 5 karakter' })
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @MinLength(2, { message: 'Kota/kabupaten wajib diisi' })
  city?: string;

  @ApiPropertyOptional({
    description: 'Kirim string kosong untuk mengosongkan',
  })
  @IsOptional()
  @Transform(keepEmpty)
  @IsString()
  postalCode?: string;
}
