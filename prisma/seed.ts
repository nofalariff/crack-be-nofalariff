import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { PrismaClient, ShipmentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  OPERATIONAL_ITEMS,
  OPERATIONAL_PLAN,
  OPERATIONAL_RECIPIENTS,
  OPERATIONAL_SENDERS,
  RECIPIENTS,
  RESI_ALPHABET,
  ROUTES,
  SEED_PASSWORD,
  STATUS_PATH,
  USERS,
  type SeedRoute,
} from './seed-data';

const prisma = new PrismaClient();
const BCRYPT_COST = 12;

// PNG 1×1 piksel — isi berkas bukti transfer contoh, supaya GET /files/:id
// pada data seed benar-benar bisa diunduh.
const PLACEHOLDER_PROOF = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

// Urutan event dalam satu hari dijaga lewat selisih milidetik agar riwayat
// tetap terbaca runut saat dua event jatuh pada hari yang sama.
const daysAgoAt = (n: number, step: number) =>
  new Date(Date.now() - n * 86_400_000 + step * 1000);

function calculateRateFor(route: SeedRoute, weight: number) {
  const chargeableWeight = Math.max(
    Math.ceil(weight),
    route.minChargeableWeight,
  );
  const weightFee = chargeableWeight * route.pricePerKg;
  const total = Math.ceil((weightFee + route.baseFee) / 100) * 100;
  return { chargeableWeight, total };
}

function locationFor(status: ShipmentStatus): string | null {
  if (status === 'IN_TRANSIT') return 'Bandara Soekarno-Hatta (CGK)';
  if (status === 'ARRIVED_AT_DESTINATION') return 'Bandara tujuan';
  return null;
}

async function storeProof(): Promise<{ storageKey: string; sizeBytes: number }> {
  const root = resolve(process.env.STORAGE_PATH ?? './uploads');
  const storageKey = `payment-proofs/${randomUUID()}.png`;
  const target = join(root, storageKey);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, PLACEHOLDER_PROOF);
  return { storageKey, sizeBytes: PLACEHOLDER_PROOF.byteLength };
}

async function createPayment(input: {
  id: string;
  shipmentId: string;
  uploadedById: string;
  claimedAmount: number;
  senderAccountName: string;
  attachmentName: string;
  transferDate: Date;
  createdAt: Date;
  status: 'VERIFIED' | 'WAITING_VERIFICATION';
  verifiedAt: Date | null;
}) {
  const stored = await storeProof();
  const attachment = await prisma.attachment.create({
    data: {
      storageKey: stored.storageKey,
      originalName: input.attachmentName,
      mimeType: input.attachmentName.endsWith('.pdf')
        ? 'application/pdf'
        : 'image/png',
      sizeBytes: stored.sizeBytes,
      uploadedById: input.uploadedById,
      createdAt: input.createdAt,
    },
  });

  await prisma.payment.create({
    data: {
      id: input.id,
      shipmentId: input.shipmentId,
      attachmentId: attachment.id,
      claimedAmount: BigInt(input.claimedAmount),
      senderAccountName: input.senderAccountName,
      transferDate: input.transferDate,
      status: input.status,
      verifiedAt: input.verifiedAt,
      createdAt: input.createdAt,
    },
  });
}

async function clean() {
  // Urutan mengikuti ketergantungan foreign key.
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.shipmentEvent.deleteMany();
  await prisma.shipmentItem.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.recipient.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.agentProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.rate.deleteMany();
  await prisma.route.deleteMany();
}

async function seedRoutes() {
  for (const route of ROUTES) {
    await prisma.route.create({
      data: {
        id: route.id,
        serviceType: route.serviceType,
        destinationCode: route.destinationCode,
        destinationName: route.destinationName,
        destinationRegion: route.destinationRegion,
        estimatedDays: route.estimatedDays,
        isActive: route.isActive,
        rates: {
          create: {
            pricePerKg: BigInt(route.pricePerKg),
            minChargeableWeight: route.minChargeableWeight,
            baseFee: BigInt(route.baseFee),
            isActive: true,
          },
        },
      },
    });
  }
}

// Admin dibuat dari environment variable, bukan dari data mock (§11.2).
async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL dan ADMIN_PASSWORD wajib diisi untuk seed.');
  }

  await prisma.user.create({
    data: {
      id: 'user-admin',
      email,
      passwordHash: await bcrypt.hash(password, BCRYPT_COST),
      fullName: 'Sari Operasional',
      phone: '+628555000111',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: daysAgo(90),
    },
  });
}

async function seedUsers() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_COST);

  for (const user of USERS) {
    await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        passwordHash,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        status: user.status,
        createdAt: daysAgo(user.createdAgo),
        ...(user.agentProfile
          ? {
              agentProfile: {
                create: {
                  companyName: user.agentProfile.companyName,
                  companyAddress: user.agentProfile.companyAddress,
                  picName: user.agentProfile.picName,
                  picPhone: user.agentProfile.picPhone,
                  npwp: user.agentProfile.npwp,
                  approvalStatus: user.agentProfile.approvalStatus,
                  rejectionReason: user.agentProfile.rejectionReason,
                  reviewedBy: user.agentProfile.reviewedAgo
                    ? 'user-admin'
                    : null,
                  reviewedAt: user.agentProfile.reviewedAgo
                    ? daysAgo(user.agentProfile.reviewedAgo)
                    : null,
                  createdAt: daysAgo(user.createdAgo),
                },
              },
            }
          : {}),
      },
    });
  }
}

async function seedRecipients() {
  for (const recipient of RECIPIENTS) {
    await prisma.recipient.create({
      data: {
        id: recipient.id,
        userId: recipient.userId,
        label: recipient.label,
        name: recipient.name,
        phone: recipient.phone,
        address: recipient.address,
        city: recipient.city,
        postalCode: recipient.postalCode,
        createdAt: daysAgo(recipient.createdAgo),
      },
    });
  }
}

function routeOf(destinationCode: string): SeedRoute {
  const route = ROUTES.find((r) => r.destinationCode === destinationCode);
  if (!route) throw new Error(`Rute ${destinationCode} tidak ada di seed.`);
  return route;
}

async function createShipment(input: {
  id: string;
  userId: string;
  trackingNumber: string;
  route: SeedRoute;
  status: ShipmentStatus;
  previousStatus: ShipmentStatus | null;
  paymentStatus: 'UNPAID' | 'WAITING_VERIFICATION' | 'PAID';
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientCity: string;
  recipientPostalCode: string | null;
  declaredWeight: number;
  actualWeight: number | null;
  chargeableWeight: number;
  totalColli: number;
  totalAmount: number;
  outstandingAmount: number;
  notes: string | null;
  cancelReason: string | null;
  deliveredTo: string | null;
  createdAt: Date;
  updatedAt: Date;
  item: { description: string; quantity: number; weight: number; declaredValue: number };
  events: Array<{ status: ShipmentStatus; daysAgo: number; notes?: string }>;
}) {
  await prisma.shipment.create({
    data: {
      id: input.id,
      userId: input.userId,
      routeId: input.route.id,
      trackingNumber: input.trackingNumber,
      serviceType: input.route.serviceType,
      status: input.status,
      previousStatus: input.previousStatus,
      paymentStatus: input.paymentStatus,
      destinationCode: input.route.destinationCode,
      destinationName: input.route.destinationName,
      estimatedDays: input.route.estimatedDays,
      senderName: input.senderName,
      senderPhone: input.senderPhone,
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
      recipientAddress: input.recipientAddress,
      recipientCity: input.recipientCity,
      recipientPostalCode: input.recipientPostalCode,
      declaredWeight: input.declaredWeight,
      actualWeight: input.actualWeight,
      chargeableWeight: input.chargeableWeight,
      totalColli: input.totalColli,
      pricePerKgSnapshot: BigInt(input.route.pricePerKg),
      baseFeeSnapshot: BigInt(input.route.baseFee),
      minChargeableWeightSnapshot: input.route.minChargeableWeight,
      totalAmount: BigInt(input.totalAmount),
      outstandingAmount: BigInt(input.outstandingAmount),
      notes: input.notes,
      cancelReason: input.cancelReason,
      deliveredTo: input.deliveredTo,
      prohibitedItemsAgreedAt: input.createdAt,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      items: {
        create: {
          description: input.item.description,
          quantity: input.item.quantity,
          weight: input.item.weight,
          declaredValue: BigInt(input.item.declaredValue),
          createdAt: input.createdAt,
        },
      },
      events: {
        create: input.events.map((event, step) => ({
          status: event.status,
          location: locationFor(event.status),
          notes: event.notes ?? null,
          createdAt: daysAgoAt(event.daysAgo, step),
        })),
      },
    },
  });
}

// Tiga kiriman ini dipakai sebagai asersi di E2E frontend — nomor resinya
// tidak boleh berubah.
async function seedCustomerShipments() {
  const upg = routeOf('UPG');
  const jatim = routeOf('JATIM');
  const mdc = routeOf('MDC');

  const first = calculateRateFor(upg, 12);
  const second = calculateRateFor(jatim, 4);
  const third = calculateRateFor(mdc, 7.5);

  await createShipment({
    id: 'shipment-1',
    userId: 'user-customer',
    trackingNumber: 'LGS-260901-K7QMR',
    route: upg,
    status: 'IN_TRANSIT',
    previousStatus: null,
    paymentStatus: 'PAID',
    senderName: 'Budi Santoso',
    senderPhone: '+628123456789',
    recipientName: 'Hasan Basri',
    recipientPhone: '+628223334444',
    recipientAddress: 'Diambil di gudang kargo Bandara Sultan Hasanuddin',
    recipientCity: 'Makassar',
    recipientPostalCode: null,
    declaredWeight: 12,
    actualWeight: 12.4,
    chargeableWeight: first.chargeableWeight,
    totalColli: 2,
    totalAmount: first.total,
    outstandingAmount: 0,
    notes: null,
    cancelReason: null,
    deliveredTo: null,
    createdAt: daysAgo(4),
    updatedAt: daysAgo(1),
    item: { description: 'Pakaian dan perlengkapan rumah tangga', quantity: 2, weight: 12, declaredValue: 1_500_000 },
    events: [
      { status: 'PENDING_PAYMENT', daysAgo: 4 },
      { status: 'PAID', daysAgo: 4, notes: 'Pembayaran terverifikasi' },
      { status: 'RECEIVED_AT_WAREHOUSE', daysAgo: 2, notes: 'Berat timbang ulang 12,4 kg' },
      { status: 'IN_TRANSIT', daysAgo: 1 },
    ],
  });
  await createPayment({
    id: 'payment-1',
    shipmentId: 'shipment-1',
    uploadedById: 'user-customer',
    claimedAmount: first.total,
    senderAccountName: 'Budi Santoso',
    attachmentName: 'bukti-transfer.jpg',
    transferDate: daysAgo(4),
    createdAt: daysAgo(4),
    status: 'VERIFIED',
    verifiedAt: daysAgo(4),
  });

  await createShipment({
    id: 'shipment-2',
    userId: 'user-customer',
    trackingNumber: 'LGS-260908-B4XTN',
    route: jatim,
    status: 'PENDING_PAYMENT',
    previousStatus: null,
    paymentStatus: 'UNPAID',
    senderName: 'Budi Santoso',
    senderPhone: '+628123456789',
    recipientName: 'Dewi Lestari',
    recipientPhone: '+628556667777',
    recipientAddress: 'Jl. Raya Darmo No. 88, Wonokromo',
    recipientCity: 'Surabaya',
    recipientPostalCode: '60241',
    declaredWeight: 4,
    actualWeight: null,
    chargeableWeight: second.chargeableWeight,
    totalColli: 1,
    totalAmount: second.total,
    outstandingAmount: second.total,
    notes: 'Mohon dibungkus kayu',
    cancelReason: null,
    deliveredTo: null,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    item: { description: 'Alat elektronik rumah tangga', quantity: 1, weight: 4, declaredValue: 2_000_000 },
    events: [{ status: 'PENDING_PAYMENT', daysAgo: 1 }],
  });

  await createShipment({
    id: 'shipment-3',
    userId: 'user-agent-approved',
    trackingNumber: 'LGS-260820-M9DHP',
    route: mdc,
    status: 'DELIVERED',
    previousStatus: null,
    paymentStatus: 'PAID',
    senderName: 'CV Rahayu Logistik',
    senderPhone: '+628987654321',
    recipientName: 'Grace Wenas',
    recipientPhone: '+628778889999',
    recipientAddress: 'Diambil di gudang kargo Bandara Sam Ratulangi',
    recipientCity: 'Manado',
    recipientPostalCode: null,
    declaredWeight: 7.5,
    actualWeight: 7.5,
    chargeableWeight: third.chargeableWeight,
    totalColli: 3,
    totalAmount: third.total,
    outstandingAmount: 0,
    notes: null,
    cancelReason: null,
    deliveredTo: 'Grace Wenas',
    createdAt: daysAgo(26),
    updatedAt: daysAgo(21),
    item: { description: 'Produk kosmetik', quantity: 3, weight: 7.5, declaredValue: 3_200_000 },
    events: [
      { status: 'PENDING_PAYMENT', daysAgo: 26 },
      { status: 'PAID', daysAgo: 26 },
      { status: 'RECEIVED_AT_WAREHOUSE', daysAgo: 25 },
      { status: 'IN_TRANSIT', daysAgo: 24 },
      { status: 'ARRIVED_AT_DESTINATION', daysAgo: 22 },
      { status: 'READY_FOR_PICKUP', daysAgo: 22 },
      { status: 'DELIVERED', daysAgo: 21, notes: 'Diambil oleh Grace Wenas' },
    ],
  });
  await createPayment({
    id: 'payment-3',
    shipmentId: 'shipment-3',
    uploadedById: 'user-agent-approved',
    claimedAmount: third.total,
    senderAccountName: 'CV Rahayu Logistik',
    attachmentName: 'transfer-agustus.pdf',
    transferDate: daysAgo(26),
    createdAt: daysAgo(26),
    status: 'VERIFIED',
    verifiedAt: daysAgo(26),
  });
}

// 37 kiriman operasional: tersebar di seluruh status dan rute, termasuk 10
// yang sengaja mandek dan 2 ON_HOLD dengan previousStatus terisi (§11.1).
async function seedOperationalShipments() {
  for (const [index, plan] of OPERATIONAL_PLAN.entries()) {
    const route = routeOf(plan.destination);
    const rate = calculateRateFor(route, plan.weight);
    const sender = OPERATIONAL_SENDERS[index % OPERATIONAL_SENDERS.length];
    const recipient =
      OPERATIONAL_RECIPIENTS[index % OPERATIONAL_RECIPIENTS.length];
    const description = OPERATIONAL_ITEMS[index % OPERATIONAL_ITEMS.length];

    // Riwayat dibangun mundur dari status sekarang supaya linimasanya masuk akal.
    const effectiveStatus = plan.previousStatus ?? plan.status;
    const pathEnd = STATUS_PATH.indexOf(effectiveStatus);
    const path =
      pathEnd >= 0
        ? STATUS_PATH.slice(0, pathEnd + 1)
        : (['PENDING_PAYMENT'] as ShipmentStatus[]);
    const filteredPath = path.filter((status) => {
      if (status === 'READY_FOR_PICKUP')
        return route.serviceType === 'PORT_TO_PORT';
      if (status === 'OUT_FOR_DELIVERY')
        return route.serviceType === 'PORT_TO_DOOR';
      return true;
    });

    const createdDaysAgo = plan.staleDays + filteredPath.length + 2;
    const timeline = filteredPath.map((status, step) => ({
      status,
      daysAgo: Math.max(
        plan.staleDays,
        createdDaysAgo -
          step *
            Math.max(
              1,
              Math.floor(createdDaysAgo / (filteredPath.length + 1)),
            ),
      ),
    }));

    // Status penutup (ON_HOLD) menjadi entri terakhir.
    if (plan.status !== effectiveStatus) {
      timeline.push({ status: plan.status, daysAgo: plan.staleDays });
    }

    const isPaid = filteredPath.includes('PAID');
    const isDoor = route.serviceType === 'PORT_TO_DOOR';
    const shipmentId = `shipment-op-${index}`;

    await createShipment({
      id: shipmentId,
      userId: sender.userId,
      trackingNumber: `LGS-2608${String(10 + index).padStart(2, '0')}-${RESI_ALPHABET[index % RESI_ALPHABET.length]}${String(index).padStart(2, '0')}QX`,
      route,
      status: plan.status,
      previousStatus: plan.previousStatus ?? null,
      paymentStatus: isPaid
        ? 'PAID'
        : plan.awaitingVerification
          ? 'WAITING_VERIFICATION'
          : 'UNPAID',
      senderName: sender.name,
      senderPhone: sender.phone,
      recipientName: recipient.name,
      recipientPhone: recipient.phone,
      recipientAddress: isDoor
        ? `Jl. Merdeka No. ${index + 1}, ${recipient.city}`
        : `Diambil di gudang kargo ${route.destinationName}`,
      recipientCity: recipient.city,
      recipientPostalCode: isDoor ? `${40000 + index}` : null,
      declaredWeight: plan.weight,
      actualWeight: isPaid ? plan.weight : null,
      chargeableWeight: rate.chargeableWeight,
      totalColli: plan.colli,
      totalAmount: rate.total,
      outstandingAmount: isPaid ? 0 : rate.total,
      notes: null,
      cancelReason:
        plan.status === 'CANCELLED'
          ? 'Dibatalkan atas permintaan pengirim'
          : null,
      deliveredTo: plan.status === 'DELIVERED' ? recipient.name : null,
      createdAt: daysAgo(createdDaysAgo),
      updatedAt: daysAgo(plan.staleDays),
      item: {
        description,
        quantity: plan.colli,
        weight: plan.weight,
        declaredValue: 500_000 * (index % 5 === 0 ? 4 : 1),
      },
      events: timeline,
    });

    if (isPaid) {
      await createPayment({
        id: `payment-op-${index}`,
        shipmentId,
        uploadedById: sender.userId,
        claimedAmount: rate.total,
        senderAccountName: sender.name,
        attachmentName: 'bukti-transfer.jpg',
        transferDate: daysAgo(createdDaysAgo),
        createdAt: daysAgo(createdDaysAgo),
        status: 'VERIFIED',
        verifiedAt: daysAgo(createdDaysAgo - 1),
      });
    } else if (plan.awaitingVerification) {
      await createPayment({
        id: `payment-op-${index}`,
        shipmentId,
        uploadedById: sender.userId,
        claimedAmount: rate.total + (plan.claimedDelta ?? 0),
        senderAccountName: sender.name,
        attachmentName: 'bukti-transfer.jpg',
        transferDate: daysAgo(plan.staleDays),
        createdAt: daysAgo(plan.staleDays),
        status: 'WAITING_VERIFICATION',
        verifiedAt: null,
      });
    }
  }
}

// Seed selalu menghapus seluruh data lebih dulu (clean). Di production itu
// hanya aman sekali, pada database yang masih kosong — dan hanya mode minimal,
// karena data contoh memakai kata sandi bersama yang diketahui publik.
async function assertSafeForProduction(minimal: boolean) {
  if (process.env.NODE_ENV !== 'production') return;

  if (!minimal) {
    throw new Error(
      'Seed lengkap (akun contoh) dilarang di production. Gunakan --minimal.',
    );
  }
  if ((process.env.ADMIN_PASSWORD ?? '').length < 12) {
    throw new Error('ADMIN_PASSWORD production minimal 12 karakter.');
  }
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    throw new Error(
      `Database production sudah berisi ${existingUsers} akun — seed dibatalkan agar data tidak terhapus.`,
    );
  }
}

async function main() {
  const minimal = process.argv.includes('--minimal');
  await assertSafeForProduction(minimal);

  console.log(
    minimal
      ? 'Menyiapkan data minimal (admin + rute + tarif)…'
      : 'Menyiapkan data lengkap replika mock frontend…',
  );

  await clean();
  await seedRoutes();
  await seedAdmin();

  if (!minimal) {
    await seedUsers();
    await seedRecipients();
    await seedCustomerShipments();
    await seedOperationalShipments();
  }

  const [routes, users, shipments, payments] = await Promise.all([
    prisma.route.count(),
    prisma.user.count(),
    prisma.shipment.count(),
    prisma.payment.count(),
  ]);

  console.log(
    `Selesai — ${routes} rute, ${users} akun, ${shipments} kiriman, ${payments} pembayaran.`,
  );
  if (!minimal) {
    console.log(`Kata sandi seluruh akun contoh: ${SEED_PASSWORD}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
