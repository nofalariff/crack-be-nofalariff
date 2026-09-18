import { ServiceType, ShipmentStatus } from '@prisma/client';

// State machine status kiriman — planbackend.md §7.3 / PRD §8.3.
// Fungsi murni supaya seluruh aturannya bisa diuji unit tanpa database.

const STATUS_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['RECEIVED_AT_WAREHOUSE', 'CANCELLED'],
  RECEIVED_AT_WAREHOUSE: ['IN_TRANSIT', 'ON_HOLD', 'CANCELLED'],
  IN_TRANSIT: ['ARRIVED_AT_DESTINATION', 'ON_HOLD'],
  ARRIVED_AT_DESTINATION: ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'ON_HOLD'],
  READY_FOR_PICKUP: ['DELIVERED', 'ON_HOLD'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'ON_HOLD'],
  // Jalan keluar dari ON_HOLD ditentukan previousStatus, bukan daftar ini.
  ON_HOLD: [],
  DELIVERED: [],
  CANCELLED: [],
};

// Status akhir pengantaran berbeda menurut layanan: Port to Port diambil
// sendiri di pelabuhan tujuan, Port to Door diantar ke alamat (§7.3 aturan 1).
function isAllowedForService(
  status: ShipmentStatus,
  serviceType: ServiceType,
): boolean {
  if (status === 'READY_FOR_PICKUP') return serviceType === 'PORT_TO_PORT';
  if (status === 'OUT_FOR_DELIVERY') return serviceType === 'PORT_TO_DOOR';
  return true;
}

export function getAllowedTransitions(
  status: ShipmentStatus,
  serviceType: ServiceType,
  previousStatus?: ShipmentStatus | null,
): ShipmentStatus[] {
  // Keluar dari ON_HOLD hanya boleh ke status sebelum tertahan, atau
  // dibatalkan (§7.3 aturan 2).
  if (status === 'ON_HOLD') {
    const back =
      previousStatus && previousStatus !== 'ON_HOLD' ? [previousStatus] : [];
    return [...back, 'CANCELLED' as ShipmentStatus].filter((next) =>
      isAllowedForService(next, serviceType),
    );
  }

  return STATUS_TRANSITIONS[status].filter((next) =>
    isAllowedForService(next, serviceType),
  );
}

export function isValidTransition(
  from: ShipmentStatus,
  to: ShipmentStatus,
  serviceType: ServiceType,
  previousStatus?: ShipmentStatus | null,
): boolean {
  return getAllowedTransitions(from, serviceType, previousStatus).includes(to);
}

/** ON_HOLD dan CANCELLED wajib menyertakan alasan (§7.3 aturan 3). */
export function requiresReason(status: ShipmentStatus): boolean {
  return status === 'ON_HOLD' || status === 'CANCELLED';
}

/** DELIVERED wajib mencatat siapa yang menerima barang (§7.3 aturan 3). */
export function requiresDeliveredTo(status: ShipmentStatus): boolean {
  return status === 'DELIVERED';
}

export interface TransitionInput {
  status: ShipmentStatus;
  serviceType: ServiceType;
  previousStatus?: ShipmentStatus | null;
  deliveredTo?: string;
  reason?: string;
}

/**
 * Memeriksa satu perubahan status. Mengembalikan pesan penolakan bila tidak
 * sah, atau null bila boleh dijalankan — supaya pemanggil satuan bisa
 * membalas 422 dan pemanggil massal bisa melewatinya (§7.3, FR-TRACK-03).
 */
export function checkTransition(
  next: ShipmentStatus,
  input: TransitionInput,
): string | null {
  if (
    !isValidTransition(
      input.status,
      next,
      input.serviceType,
      input.previousStatus,
    )
  ) {
    const allowed = getAllowedTransitions(
      input.status,
      input.serviceType,
      input.previousStatus,
    );
    return allowed.length
      ? `Status tidak dapat diubah ke sana. Yang diizinkan: ${allowed.join(', ')}.`
      : 'Kiriman ini sudah berstatus akhir dan tidak dapat diubah lagi.';
  }

  if (requiresDeliveredTo(next) && !input.deliveredTo?.trim()) {
    return 'Nama penerima barang wajib diisi untuk status Diterima.';
  }

  if (requiresReason(next) && !input.reason?.trim()) {
    return 'Alasan wajib diisi untuk status ini.';
  }

  return null;
}

/**
 * previousStatus hanya terisi selama kiriman tertahan: diisi saat masuk
 * ON_HOLD, dikosongkan saat keluar (§5.3.4).
 */
export function nextPreviousStatus(
  current: ShipmentStatus,
  next: ShipmentStatus,
): ShipmentStatus | null | undefined {
  if (next === 'ON_HOLD') return current;
  if (current === 'ON_HOLD') return null;
  return undefined;
}
