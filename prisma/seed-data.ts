import { ApprovalStatus, ServiceType, ShipmentStatus, UserRole, UserStatus } from '@prisma/client';

// Replika src/mocks/db.ts dari repo frontend — bukan demi kemiripan, tetapi
// supaya 58 pengujian E2E frontend dapat dijalankan ulang terhadap backend
// asli tanpa mengubah satu pun asersinya (planbackend.md §11).
//
// JANGAN mengubah nomor resi milik budi@example.com dan agen@example.com:
// keduanya dipakai sebagai asersi di E2E frontend.

export const SEED_PASSWORD = 'password123';

export interface SeedRoute {
  id: string;
  serviceType: ServiceType;
  destinationCode: string;
  destinationName: string;
  destinationRegion: string;
  estimatedDays: number;
  isActive: boolean;
  pricePerKg: number;
  minChargeableWeight: number;
  baseFee: number;
}

export const ROUTES: SeedRoute[] = [
  { id: 'route-plw', serviceType: 'PORT_TO_PORT', destinationCode: 'PLW', destinationName: 'Palu (PLW)', destinationRegion: 'Sulawesi Tengah', estimatedDays: 3, isActive: true, pricePerKg: 28_000, minChargeableWeight: 5, baseFee: 15_000 },
  { id: 'route-upg', serviceType: 'PORT_TO_PORT', destinationCode: 'UPG', destinationName: 'Makassar (UPG)', destinationRegion: 'Sulawesi Selatan', estimatedDays: 2, isActive: true, pricePerKg: 24_000, minChargeableWeight: 5, baseFee: 15_000 },
  { id: 'route-mdc', serviceType: 'PORT_TO_PORT', destinationCode: 'MDC', destinationName: 'Manado (MDC)', destinationRegion: 'Sulawesi Utara', estimatedDays: 3, isActive: true, pricePerKg: 31_000, minChargeableWeight: 5, baseFee: 15_000 },
  { id: 'route-jabodetabek', serviceType: 'PORT_TO_DOOR', destinationCode: 'JABODETABEK', destinationName: 'Jabodetabek', destinationRegion: 'Jakarta, Bogor, Depok, Tangerang, Bekasi', estimatedDays: 1, isActive: true, pricePerKg: 9_000, minChargeableWeight: 3, baseFee: 10_000 },
  { id: 'route-jabar', serviceType: 'PORT_TO_DOOR', destinationCode: 'JABAR', destinationName: 'Jawa Barat', destinationRegion: 'Jawa Barat di luar Jabodetabek', estimatedDays: 2, isActive: true, pricePerKg: 12_000, minChargeableWeight: 3, baseFee: 10_000 },
  { id: 'route-banten', serviceType: 'PORT_TO_DOOR', destinationCode: 'BANTEN', destinationName: 'Banten', destinationRegion: 'Banten di luar Tangerang', estimatedDays: 2, isActive: true, pricePerKg: 12_000, minChargeableWeight: 3, baseFee: 10_000 },
  { id: 'route-jateng', serviceType: 'PORT_TO_DOOR', destinationCode: 'JATENG_DIY', destinationName: 'Jawa Tengah & DI Yogyakarta', destinationRegion: 'Jawa Tengah, DI Yogyakarta', estimatedDays: 2, isActive: true, pricePerKg: 14_000, minChargeableWeight: 3, baseFee: 10_000 },
  { id: 'route-jatim', serviceType: 'PORT_TO_DOOR', destinationCode: 'JATIM', destinationName: 'Jawa Timur', destinationRegion: 'Jawa Timur', estimatedDays: 3, isActive: true, pricePerKg: 16_000, minChargeableWeight: 3, baseFee: 10_000 },
];

export interface SeedAgentProfile {
  companyName: string;
  companyAddress: string;
  picName: string;
  picPhone: string;
  npwp: string | null;
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  reviewedAgo: number | null;
}

export interface SeedUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  createdAgo: number;
  agentProfile: SeedAgentProfile | null;
}

export const USERS: SeedUser[] = [
  { id: 'user-customer', email: 'budi@example.com', fullName: 'Budi Santoso', phone: '+628123456789', role: 'CUSTOMER', status: 'ACTIVE', createdAgo: 40, agentProfile: null },
  {
    id: 'user-agent-approved', email: 'agen@example.com', fullName: 'Siti Rahayu', phone: '+628987654321', role: 'AGENT', status: 'ACTIVE', createdAgo: 60,
    agentProfile: { companyName: 'CV Rahayu Logistik', companyAddress: 'Jl. Mangga Besar No. 12, Jakarta Barat', picName: 'Siti Rahayu', picPhone: '+628987654321', npwp: '09.254.294.1-407.000', approvalStatus: 'APPROVED', rejectionReason: null, reviewedAgo: 58 },
  },
  {
    id: 'user-agent-pending', email: 'agenbaru@example.com', fullName: 'Andi Pratama', phone: '+628111222333', role: 'AGENT', status: 'ACTIVE', createdAgo: 2,
    agentProfile: { companyName: 'Toko Pratama Jaya', companyAddress: 'Jl. Kebon Jeruk No. 5, Jakarta Barat', picName: 'Andi Pratama', picPhone: '+628111222333', npwp: null, approvalStatus: 'PENDING', rejectionReason: null, reviewedAgo: null },
  },
  { id: 'user-cust-dewi', email: 'dewi@example.com', fullName: 'Dewi Lestari', phone: '+628556667777', role: 'CUSTOMER', status: 'ACTIVE', createdAgo: 70, agentProfile: null },
  { id: 'user-cust-rahmat', email: 'rahmat@example.com', fullName: 'Rahmat Hidayat', phone: '+628334445555', role: 'CUSTOMER', status: 'ACTIVE', createdAgo: 35, agentProfile: null },
  { id: 'user-cust-suspended', email: 'nonaktif@example.com', fullName: 'Joko Nugroho', phone: '+628778881234', role: 'CUSTOMER', status: 'SUSPENDED', createdAgo: 120, agentProfile: null },
  {
    id: 'user-agent-nusantara', email: 'kargo@example.com', fullName: 'Lina Wijaya', phone: '+628221119999', role: 'AGENT', status: 'ACTIVE', createdAgo: 100,
    agentProfile: { companyName: 'PT Nusantara Kargo', companyAddress: 'Jl. Gatot Subroto No. 88, Jakarta Selatan', picName: 'Lina Wijaya', picPhone: '+628221119999', npwp: '01.123.456.7-011.000', approvalStatus: 'APPROVED', rejectionReason: null, reviewedAgo: 98 },
  },
  {
    id: 'user-agent-rejected', email: 'agenditolak@example.com', fullName: 'Eko Saputro', phone: '+628445556666', role: 'AGENT', status: 'ACTIVE', createdAgo: 12,
    agentProfile: { companyName: 'UD Saputro Trans', companyAddress: 'Jl. Melati No. 3, Bekasi', picName: 'Eko Saputro', picPhone: '+628445556666', npwp: null, approvalStatus: 'REJECTED', rejectionReason: 'Alamat perusahaan tidak dapat diverifikasi. Mohon lampirkan data yang sesuai dengan dokumen legal usaha Anda.', reviewedAgo: 9 },
  },
  {
    id: 'user-agent-baru2', email: 'agenkedua@example.com', fullName: 'Maya Kusuma', phone: '+628667778888', role: 'AGENT', status: 'ACTIVE', createdAgo: 4,
    agentProfile: { companyName: 'CV Kusuma Ekspres', companyAddress: 'Jl. Pahlawan No. 21, Tangerang Selatan', picName: 'Maya Kusuma', picPhone: '+628667778888', npwp: '02.987.654.3-022.000', approvalStatus: 'PENDING', rejectionReason: null, reviewedAgo: null },
  },
];

export const OPERATIONAL_SENDERS = [
  { userId: 'user-cust-dewi', name: 'Dewi Lestari', phone: '+628556667777' },
  { userId: 'user-cust-rahmat', name: 'Rahmat Hidayat', phone: '+628334445555' },
  { userId: 'user-agent-nusantara', name: 'PT Nusantara Kargo', phone: '+628221119999' },
  { userId: 'user-cust-suspended', name: 'Joko Nugroho', phone: '+628778881234' },
];

export const OPERATIONAL_RECIPIENTS = [
  { name: 'Andi Saputra', city: 'Makassar', phone: '+628211112222' },
  { name: 'Nurul Aini', city: 'Palu', phone: '+628211113333' },
  { name: 'Reza Maulana', city: 'Manado', phone: '+628211114444' },
  { name: 'Sinta Dewi', city: 'Surabaya', phone: '+628211115555' },
  { name: 'Bagas Prakoso', city: 'Semarang', phone: '+628211116666' },
  { name: 'Putri Ayu', city: 'Bandung', phone: '+628211117777' },
  { name: 'Hendra Gunawan', city: 'Yogyakarta', phone: '+628211118888' },
  { name: 'Ratna Sari', city: 'Bogor', phone: '+628211119999' },
];

export const OPERATIONAL_ITEMS = [
  'Pakaian jadi',
  'Suku cadang motor',
  'Produk kecantikan',
  'Makanan kering kemasan',
  'Peralatan dapur',
  'Buku dan alat tulis',
  'Perangkat elektronik kecil',
  'Kain gulungan',
];

export interface OperationalPlanEntry {
  status: ShipmentStatus;
  destination: string;
  weight: number;
  colli: number;
  staleDays: number;
  awaitingVerification?: boolean;
  claimedDelta?: number;
  previousStatus?: ShipmentStatus;
}

export const OPERATIONAL_PLAN: OperationalPlanEntry[] = [
  { status: 'PENDING_PAYMENT', destination: 'UPG', weight: 8, colli: 1, staleDays: 1 },
  { status: 'PENDING_PAYMENT', destination: 'JATIM', weight: 3, colli: 1, staleDays: 5 },
  { status: 'PENDING_PAYMENT', destination: 'PLW', weight: 15, colli: 2, staleDays: 1, awaitingVerification: true },
  { status: 'PENDING_PAYMENT', destination: 'MDC', weight: 6, colli: 1, staleDays: 2, awaitingVerification: true },
  { status: 'PENDING_PAYMENT', destination: 'JATENG_DIY', weight: 4.5, colli: 1, staleDays: 3, awaitingVerification: true, claimedDelta: -50_000 },
  { status: 'PENDING_PAYMENT', destination: 'JABODETABEK', weight: 2, colli: 1, staleDays: 4, awaitingVerification: true },
  { status: 'PAID', destination: 'UPG', weight: 22, colli: 3, staleDays: 1 },
  { status: 'PAID', destination: 'JABAR', weight: 9, colli: 2, staleDays: 5 },
  { status: 'PAID', destination: 'MDC', weight: 11, colli: 1, staleDays: 2 },
  { status: 'RECEIVED_AT_WAREHOUSE', destination: 'UPG', weight: 30, colli: 4, staleDays: 1 },
  { status: 'RECEIVED_AT_WAREHOUSE', destination: 'PLW', weight: 18, colli: 2, staleDays: 2 },
  { status: 'RECEIVED_AT_WAREHOUSE', destination: 'MDC', weight: 25, colli: 3, staleDays: 6 },
  { status: 'RECEIVED_AT_WAREHOUSE', destination: 'JATIM', weight: 7, colli: 1, staleDays: 1 },
  { status: 'RECEIVED_AT_WAREHOUSE', destination: 'JATENG_DIY', weight: 12, colli: 2, staleDays: 1 },
  { status: 'IN_TRANSIT', destination: 'UPG', weight: 40, colli: 5, staleDays: 1 },
  { status: 'IN_TRANSIT', destination: 'PLW', weight: 16, colli: 2, staleDays: 4 },
  { status: 'IN_TRANSIT', destination: 'MDC', weight: 9.5, colli: 1, staleDays: 2 },
  { status: 'IN_TRANSIT', destination: 'JABAR', weight: 5, colli: 1, staleDays: 7 },
  { status: 'ARRIVED_AT_DESTINATION', destination: 'UPG', weight: 14, colli: 2, staleDays: 1 },
  { status: 'ARRIVED_AT_DESTINATION', destination: 'PLW', weight: 20, colli: 3, staleDays: 5 },
  { status: 'ARRIVED_AT_DESTINATION', destination: 'JATIM', weight: 6.5, colli: 1, staleDays: 2 },
  { status: 'READY_FOR_PICKUP', destination: 'UPG', weight: 13, colli: 2, staleDays: 3 },
  { status: 'READY_FOR_PICKUP', destination: 'MDC', weight: 17, colli: 2, staleDays: 8 },
  { status: 'READY_FOR_PICKUP', destination: 'PLW', weight: 10, colli: 1, staleDays: 1 },
  { status: 'OUT_FOR_DELIVERY', destination: 'JABODETABEK', weight: 3.5, colli: 1, staleDays: 1 },
  { status: 'OUT_FOR_DELIVERY', destination: 'JATENG_DIY', weight: 8, colli: 2, staleDays: 1 },
  { status: 'OUT_FOR_DELIVERY', destination: 'JATIM', weight: 5.5, colli: 1, staleDays: 4 },
  { status: 'DELIVERED', destination: 'UPG', weight: 19, colli: 2, staleDays: 12 },
  { status: 'DELIVERED', destination: 'PLW', weight: 8, colli: 1, staleDays: 20 },
  { status: 'DELIVERED', destination: 'MDC', weight: 26, colli: 3, staleDays: 15 },
  { status: 'DELIVERED', destination: 'JABODETABEK', weight: 4, colli: 1, staleDays: 9 },
  { status: 'DELIVERED', destination: 'JATIM', weight: 11, colli: 2, staleDays: 30 },
  { status: 'DELIVERED', destination: 'JABAR', weight: 7.5, colli: 1, staleDays: 18 },
  { status: 'ON_HOLD', destination: 'MDC', weight: 21, colli: 2, staleDays: 6, previousStatus: 'IN_TRANSIT' },
  { status: 'ON_HOLD', destination: 'JATIM', weight: 4, colli: 1, staleDays: 2, previousStatus: 'OUT_FOR_DELIVERY' },
  { status: 'CANCELLED', destination: 'UPG', weight: 6, colli: 1, staleDays: 14 },
  { status: 'CANCELLED', destination: 'JATENG_DIY', weight: 3, colli: 1, staleDays: 22 },
];

export const STATUS_PATH: ShipmentStatus[] = [
  'PENDING_PAYMENT',
  'PAID',
  'RECEIVED_AT_WAREHOUSE',
  'IN_TRANSIT',
  'ARRIVED_AT_DESTINATION',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export const RESI_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export const RECIPIENTS = [
  { id: 'recipient-1', userId: 'user-customer', label: 'Rumah Ibu', name: 'Hasan Basri', phone: '+628223334444', address: 'Jl. Perintis Kemerdekaan KM 10 No. 21', city: 'Makassar', postalCode: '90245', createdAgo: 30 },
  { id: 'recipient-2', userId: 'user-agent-approved', label: 'Pelanggan Manado', name: 'Grace Wenas', phone: '+628778889999', address: 'Jl. Sam Ratulangi No. 45', city: 'Manado', postalCode: '95111', createdAgo: 50 },
];
