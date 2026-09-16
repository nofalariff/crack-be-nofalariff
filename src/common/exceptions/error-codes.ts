import { HttpStatus } from '@nestjs/common';

// Katalog kode error domain — planbackend.md §6.3
export const ERROR_CODES = {
  AUTH_INVALID_CREDENTIALS: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Email atau kata sandi salah.',
  },
  AUTH_ACCOUNT_SUSPENDED: {
    status: HttpStatus.FORBIDDEN,
    message: 'Akun Anda telah dinonaktifkan.',
  },
  AGENT_NOT_APPROVED: {
    status: HttpStatus.FORBIDDEN,
    message: 'Akun agen Anda belum disetujui.',
  },
  ROUTE_NOT_SERVED: {
    status: HttpStatus.NOT_FOUND,
    message: 'Rute untuk kombinasi layanan dan tujuan ini tidak tersedia.',
  },
  ROUTE_INACTIVE: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Rute ini sedang tidak aktif.',
  },
  WEIGHT_EXCEEDS_LIMIT: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Berat melebihi batas maksimum 1.000 kg.',
  },
  SHIPMENT_INVALID_TRANSITION: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'Transisi status tidak diizinkan.',
  },
  SHIPMENT_NOT_CANCELLABLE: {
    status: HttpStatus.CONFLICT,
    message: 'Kiriman ini tidak dapat dibatalkan pada status saat ini.',
  },
  SHIPMENT_NOT_EDITABLE: {
    status: HttpStatus.CONFLICT,
    message: 'Kiriman ini tidak dapat diubah pada status saat ini.',
  },
  PAYMENT_ALREADY_VERIFIED: {
    status: HttpStatus.CONFLICT,
    message: 'Pembayaran ini sudah diverifikasi.',
  },
  FILE_TYPE_NOT_ALLOWED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Tipe berkas tidak diizinkan. Gunakan JPG, PNG, WEBP, atau PDF.',
  },
  FILE_TOO_LARGE: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Ukuran berkas melebihi batas maksimum.',
  },
  PROHIBITED_ITEMS_NOT_AGREED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Anda harus menyetujui pernyataan barang terlarang.',
  },
  VALIDATION_ERROR: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Data yang dikirim tidak valid.',
  },
  NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Data tidak ditemukan.',
  },
  UNAUTHORIZED: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Anda harus masuk untuk mengakses ini.',
  },
  FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    message: 'Anda tidak memiliki akses untuk melakukan ini.',
  },
  INTERNAL_ERROR: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Terjadi kesalahan pada server.',
  },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;
