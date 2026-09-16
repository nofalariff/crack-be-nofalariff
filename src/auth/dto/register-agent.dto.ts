import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { normalizePhone } from '../../common/utils/phone.util';
import { RegisterCustomerDto } from './register-customer.dto';

export class RegisterAgentDto extends RegisterCustomerDto {
  @ApiProperty({ example: 'PT Kargo Nusantara' })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(3, { message: 'Nama perusahaan minimal 3 karakter' })
  companyName: string;

  @ApiProperty({ example: 'Jl. Pelabuhan No. 10, Makassar' })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(10, { message: 'Alamat perusahaan minimal 10 karakter' })
  companyAddress: string;

  @ApiProperty({ example: 'Siti Aminah' })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(3, { message: 'Nama PIC minimal 3 karakter' })
  picName: string;

  @ApiProperty({ example: '0813-1111-2222' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? (normalizePhone(value) ?? value) : value,
  )
  @Matches(/^\+62\d{7,13}$/, {
    message: 'Format nomor HP tidak valid. Contoh: 0812-3456-7890',
  })
  picPhone: string;

  @ApiPropertyOptional({ example: '01.234.567.8-901.000' })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  })
  npwp?: string;
}
