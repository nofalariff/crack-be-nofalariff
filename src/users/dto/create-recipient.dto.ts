import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { normalizePhone } from '../../common/utils/phone.util';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const trimOrSkipIfEmpty = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class CreateRecipientDto {
  @ApiPropertyOptional({ example: 'Rumah Ibu' })
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @IsString()
  label?: string;

  @ApiProperty({ example: 'Hasan Basri' })
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Nama penerima minimal 3 karakter' })
  name: string;

  @ApiProperty({ example: '0822-3334-444' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? (normalizePhone(value) ?? value) : value,
  )
  @Matches(/^\+62\d{7,13}$/, {
    message: 'Format nomor HP tidak valid. Contoh: 0812-3456-7890',
  })
  phone: string;

  @ApiProperty({ example: 'Jl. Perintis Kemerdekaan KM 10 No. 21' })
  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Alamat minimal 5 karakter' })
  address: string;

  @ApiProperty({ example: 'Makassar' })
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Kota/kabupaten wajib diisi' })
  city: string;

  @ApiPropertyOptional({ example: '90245' })
  @IsOptional()
  @Transform(trimOrSkipIfEmpty)
  @IsString()
  postalCode?: string;
}
