import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
import { normalizePhone } from '../../common/utils/phone.util';

export class RegisterCustomerDto {
  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(3, { message: 'Nama lengkap minimal 3 karakter' })
  fullName: string;

  @ApiProperty({ example: 'budi@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Format email tidak valid' })
  email: string;

  @ApiProperty({ example: '0812-3456-7890' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? (normalizePhone(value) ?? value) : value,
  )
  @Matches(/^\+62\d{7,13}$/, {
    message: 'Format nomor HP tidak valid. Contoh: 0812-3456-7890',
  })
  phone: string;

  @ApiProperty({ example: 'Password123' })
  @MinLength(8, { message: 'Password minimal 8 karakter' })
  @Matches(/[a-zA-Z]/, {
    message: 'Password harus mengandung minimal satu huruf',
  })
  @Matches(/[0-9]/, { message: 'Password harus mengandung minimal satu angka' })
  password: string;
}
