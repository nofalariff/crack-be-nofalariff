import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { normalizePhone } from '../../common/utils/phone.util';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const toPhone = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? (normalizePhone(value) ?? value) : value;

const PHONE_PATTERN = /^\+62\d{7,13}$/;
const PHONE_MESSAGE = 'Format nomor HP tidak valid. Contoh: 0812-3456-7890';

export class CreateShipmentDto {
  @ApiProperty({ enum: ServiceType })
  @IsEnum(ServiceType, { message: 'Pilih jenis layanan' })
  serviceType: ServiceType;

  @ApiProperty({ example: 'JATIM' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Pilih tujuan pengiriman' })
  destinationCode: string;

  @ApiProperty({ example: 'Budi Santoso' })
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Nama pengirim minimal 3 karakter' })
  senderName: string;

  @ApiProperty({ example: '0812-3456-7890' })
  @Transform(toPhone)
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  senderPhone: string;

  @ApiProperty({ example: 'Dewi Lestari' })
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Nama penerima minimal 3 karakter' })
  recipientName: string;

  @ApiProperty({ example: '0855-6667-777' })
  @Transform(toPhone)
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  recipientPhone: string;

  // Alamat lengkap hanya wajib untuk Port to Door; Port to Port diambil
  // sendiri di gudang pelabuhan tujuan.
  @ApiPropertyOptional({ example: 'Jl. Raya Darmo No. 88, Wonokromo' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : '',
  )
  @ValidateIf((dto: CreateShipmentDto) => dto.serviceType === 'PORT_TO_DOOR')
  @MinLength(10, {
    message:
      'Alamat lengkap penerima wajib diisi (minimal 10 karakter) untuk layanan Port to Door',
  })
  recipientAddress: string;

  @ApiProperty({ example: 'Surabaya' })
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Kota/kabupaten wajib diisi' })
  recipientCity: string;

  @ApiPropertyOptional({ example: '60241' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  })
  @IsString()
  recipientPostalCode?: string;

  @ApiProperty({ example: 'Alat elektronik rumah tangga' })
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Deskripsi isi barang minimal 3 karakter' })
  itemDescription: string;

  @ApiProperty({ example: 4.5 })
  @IsNumber()
  @IsPositive({ message: 'Berat harus lebih dari 0 kg' })
  declaredWeight: number;

  @ApiProperty({ example: 1 })
  @IsInt({ message: 'Jumlah koli harus bilangan bulat' })
  @Min(1, { message: 'Minimal 1 koli' })
  @Max(100, { message: 'Maksimal 100 koli' })
  totalColli: number;

  @ApiPropertyOptional({ example: 2_000_000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  declaredValue?: number;

  @ApiPropertyOptional({ example: 'Mohon dibungkus kayu' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  })
  @IsString()
  notes?: string;

  // Divalidasi di service agar penolakannya memakai kode domain
  // PROHIBITED_ITEMS_NOT_AGREED, bukan VALIDATION_ERROR (§7.7).
  @ApiProperty({ example: true })
  @IsBoolean()
  prohibitedItemsAgreed: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  saveRecipient?: boolean;
}
