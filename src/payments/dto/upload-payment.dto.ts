import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

// Dikirim sebagai multipart/form-data — seluruh nilai tiba sebagai string,
// jadi angka dikonversi dulu sebelum divalidasi. Nama field mengikuti yang
// sudah dipakai frontend dan tidak boleh diubah (planbackend.md §6.6).
export class UploadPaymentDto {
  @ApiProperty({ example: 74_000 })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : value;
  })
  @IsInt({ message: 'Nominal transfer wajib diisi' })
  @IsPositive({ message: 'Nominal transfer harus lebih dari 0' })
  claimedAmount: number;

  @ApiProperty({ example: 'Budi Santoso' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3, { message: 'Nama pemilik rekening minimal 3 karakter' })
  senderAccountName: string;

  @ApiProperty({ example: '2026-09-18' })
  @IsISO8601({}, { message: 'Tanggal transfer wajib diisi' })
  transferDate: string;
}
