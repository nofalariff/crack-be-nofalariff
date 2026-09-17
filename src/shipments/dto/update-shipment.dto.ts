import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { normalizePhone } from '../../common/utils/phone.util';

// String kosong berarti "tidak diubah" untuk field teks biasa, kecuali
// recipientPostalCode dan notes yang memakai string kosong untuk mengosongkan
// nilainya (mengikuti perilaku mock frontend).
const trimOrSkipIfEmpty = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

const phoneOrSkipIfEmpty = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  return normalizePhone(trimmed) ?? trimmed;
};

export class UpdateShipmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @MinLength(3, { message: 'Nama penerima minimal 3 karakter' })
  recipientName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(phoneOrSkipIfEmpty)
  @Matches(/^\+62\d{7,13}$/, {
    message: 'Format nomor HP tidak valid. Contoh: 0812-3456-7890',
  })
  recipientPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @IsString()
  recipientAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @MinLength(2, { message: 'Kota/kabupaten wajib diisi' })
  recipientCity?: string;

  @ApiPropertyOptional({
    description: 'Kirim string kosong untuk mengosongkan',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  recipientPostalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @MinLength(3, { message: 'Deskripsi isi barang minimal 3 karakter' })
  itemDescription?: string;

  @ApiPropertyOptional({
    description: 'Kirim string kosong untuk mengosongkan',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  notes?: string;
}
