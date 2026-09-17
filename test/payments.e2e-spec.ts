import { unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { configureApp } from './../src/setup-app';

const SUFFIX = `@b5e2e-${Date.now()}.test`;
const adminEmail = `admin${SUFFIX}`;
const customerEmail = `customer${SUFFIX}`;
const otherCustomerEmail = `other${SUFFIX}`;
const destinationCode = `B5E2E${Date.now().toString(36).toUpperCase()}`;

// PNG 1×1 piksel — magic number PNG yang sah.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
// Teks biasa yang diberi nama .png — harus ditolak karena isinya bukan gambar.
const FAKE_PNG_BYTES = Buffer.from('ini cuma teks biasa, bukan gambar', 'utf8');

const booking = {
  serviceType: 'PORT_TO_DOOR',
  destinationCode,
  senderName: 'Budi Santoso',
  senderPhone: '0812-3456-7890',
  recipientName: 'Dewi Lestari',
  recipientPhone: '0855-6667-777',
  recipientAddress: 'Jl. Raya Darmo No. 88, Wonokromo',
  recipientCity: 'Surabaya',
  itemDescription: 'Alat elektronik rumah tangga',
  declaredWeight: 4,
  totalColli: 1,
  prohibitedItemsAgreed: true,
};

describe('Payments (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let customerToken: string;
  let otherToken: string;

  const api = () => request(app.getHttpServer());

  const login = async (email: string, password: string) => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email, password });
    return res.body.data.accessToken as string;
  };

  const book = async () => {
    const res = await api()
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(booking);
    return res.body.data as { id: string; trackingNumber: string };
  };

  const uploadProof = (
    shipmentId: string,
    bytes: Buffer,
    filename = 'bukti-transfer.png',
    claimedAmount = 74_000,
  ) =>
    api()
      .post(`/api/v1/shipments/${shipmentId}/payments`)
      .set('Authorization', `Bearer ${customerToken}`)
      .field('claimedAmount', String(claimedAmount))
      .field('senderAccountName', 'Budi Santoso')
      .field('transferDate', '2026-09-18')
      .attach('proof', bytes, filename);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash('AdminPassword123', 12),
        fullName: 'B5 E2E Admin',
        phone: '+628110000000',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    adminToken = await login(adminEmail, 'AdminPassword123');

    for (const email of [customerEmail, otherCustomerEmail]) {
      await api().post('/api/v1/auth/register').send({
        fullName: 'Pengguna Uji B5',
        email,
        phone: '0812-0000-0000',
        password: 'Password123',
      });
    }
    customerToken = await login(customerEmail, 'Password123');
    otherToken = await login(otherCustomerEmail, 'Password123');

    const route = await api()
      .post('/api/v1/admin/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        serviceType: 'PORT_TO_DOOR',
        destinationCode,
        destinationName: 'Rute Uji B5',
        destinationRegion: 'Wilayah Uji',
        estimatedDays: 3,
      });
    await api()
      .put(`/api/v1/admin/routes/${route.body.data.id}/rate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pricePerKg: 16_000, minChargeableWeight: 3, baseFee: 10_000 });
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: SUFFIX } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);

    // Bersihkan berkas yang benar-benar tertulis ke disk selama pengujian.
    const attachments = await prisma.attachment.findMany({
      where: { uploadedById: { in: userIds } },
      select: { storageKey: true },
    });
    const root = resolve(process.env.STORAGE_PATH ?? './uploads');
    await Promise.all(
      attachments.map((attachment) =>
        unlink(join(root, attachment.storageKey)).catch(() => undefined),
      ),
    );

    await prisma.shipment.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.attachment.deleteMany({
      where: { uploadedById: { in: userIds } },
    });
    await prisma.recipient.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.route.deleteMany({ where: { destinationCode } });
    await app.close();
  });

  describe('GET /shipments/:trackingNumber/invoice', () => {
    it('menerbitkan tagihan dengan jatuh tempo 72 jam dan rekening tujuan', async () => {
      const shipment = await book();

      const res = await api()
        .get(`/api/v1/shipments/${shipment.trackingNumber}/invoice`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        trackingNumber: shipment.trackingNumber,
        chargeableWeight: 4,
        pricePerKg: 16_000,
        weightFee: 64_000,
        baseFee: 10_000,
        totalAmount: 74_000,
        outstandingAmount: 74_000,
        paymentStatus: 'UNPAID',
        customerEmail,
        payments: [],
      });
      expect(res.body.data.bankAccount).toMatchObject({
        bankName: expect.any(String),
        accountNumber: expect.any(String),
        accountHolder: expect.any(String),
      });

      const issued = new Date(res.body.data.issuedAt as string).getTime();
      const due = new Date(res.body.data.dueAt as string).getTime();
      expect(due - issued).toBe(72 * 60 * 60 * 1000);
    });

    it('membalas 404 untuk tagihan milik orang lain', async () => {
      const shipment = await book();

      const res = await api()
        .get(`/api/v1/shipments/${shipment.trackingNumber}/invoice`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /shipments/:id/payments', () => {
    it('menerima bukti transfer dan menandai kiriman menunggu verifikasi', async () => {
      const shipment = await book();

      const res = await uploadProof(shipment.id, PNG_BYTES);

      expect(res.status).toBe(201);
      expect(res.body.data.paymentStatus).toBe('WAITING_VERIFICATION');
      expect(res.body.data.payments).toHaveLength(1);
      expect(res.body.data.payments[0]).toMatchObject({
        claimedAmount: 74_000,
        senderAccountName: 'Budi Santoso',
        status: 'WAITING_VERIFICATION',
        rejectionReason: null,
        verifiedAt: null,
        attachmentName: 'bukti-transfer.png',
      });
      // Status kiriman belum berubah sampai admin memverifikasi.
      expect(res.body.data.status).toBe('PENDING_PAYMENT');
    });

    it('menolak berkas yang isinya bukan gambar walau ekstensinya .png', async () => {
      const shipment = await book();

      const res = await uploadProof(shipment.id, FAKE_PNG_BYTES);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FILE_TYPE_NOT_ALLOWED');
    });

    it('menolak permintaan tanpa berkas', async () => {
      const shipment = await book();

      const res = await api()
        .post(`/api/v1/shipments/${shipment.id}/payments`)
        .set('Authorization', `Bearer ${customerToken}`)
        .field('claimedAmount', '74000')
        .field('senderAccountName', 'Budi Santoso')
        .field('transferDate', '2026-09-18');

      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [{ field: 'proof' }],
      });
    });

    it('menolak unggahan pada kiriman yang sudah dibatalkan', async () => {
      const shipment = await book();
      await api()
        .post(`/api/v1/shipments/${shipment.id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      const res = await uploadProof(shipment.id, PNG_BYTES);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SHIPMENT_NOT_EDITABLE');
    });

    it('membalas 404 untuk kiriman milik orang lain', async () => {
      const shipment = await book();

      const res = await api()
        .post(`/api/v1/shipments/${shipment.id}/payments`)
        .set('Authorization', `Bearer ${otherToken}`)
        .field('claimedAmount', '74000')
        .field('senderAccountName', 'Penyusup')
        .field('transferDate', '2026-09-18')
        .attach('proof', PNG_BYTES, 'bukti.png');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /admin/payments — antrean verifikasi', () => {
    it('menolak non-admin', async () => {
      const res = await api()
        .get('/api/v1/admin/payments')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('menampilkan selisih nominal terhadap tagihan', async () => {
      const shipment = await book();
      await uploadProof(shipment.id, PNG_BYTES, 'kurang-bayar.png', 24_000);

      const res = await api()
        .get('/api/v1/admin/payments?limit=100')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const item = res.body.data.find(
        (row: { shipmentId: string }) => row.shipmentId === shipment.id,
      ) as { difference: number; totalAmount: number; status: string };

      expect(item).toMatchObject({
        totalAmount: 74_000,
        claimedAmount: 24_000,
        difference: -50_000,
        status: 'WAITING_VERIFICATION',
        customerEmail,
      });
    });
  });

  describe('alur lengkap booking → invoice → unggah → verifikasi', () => {
    it('melunasi kiriman dan menambahkan event PAID', async () => {
      const shipment = await book();
      await uploadProof(shipment.id, PNG_BYTES);

      const queue = await api()
        .get('/api/v1/admin/payments?limit=100')
        .set('Authorization', `Bearer ${adminToken}`);
      const paymentId = (
        queue.body.data.find(
          (row: { shipmentId: string }) => row.shipmentId === shipment.id,
        ) as { paymentId: string }
      ).paymentId;

      const verified = await api()
        .post(`/api/v1/admin/payments/${paymentId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      expect(verified.status).toBe(200);
      expect(verified.body.data).toMatchObject({
        status: 'PAID',
        paymentStatus: 'PAID',
        outstandingAmount: 0,
      });
      expect(verified.body.data.payments[0]).toMatchObject({
        status: 'VERIFIED',
      });
      expect(verified.body.data.payments[0].verifiedAt).not.toBeNull();
      expect(
        verified.body.data.events.some(
          (event: { status: string; notes: string | null }) =>
            event.status === 'PAID' &&
            event.notes === 'Pembayaran terverifikasi',
        ),
      ).toBe(true);

      // Verifikasi ulang ditolak, bukan menggandakan event.
      const again = await api()
        .post(`/api/v1/admin/payments/${paymentId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('PAYMENT_ALREADY_VERIFIED');

      // Customer tidak bisa mengunggah bukti lagi setelah lunas.
      const reupload = await uploadProof(shipment.id, PNG_BYTES);
      expect(reupload.status).toBe(409);
      expect(reupload.body.error.code).toBe('PAYMENT_ALREADY_VERIFIED');
    });
  });

  describe('POST /admin/payments/:id/reject', () => {
    const findPaymentId = async (shipmentId: string) => {
      const queue = await api()
        .get('/api/v1/admin/payments?limit=100')
        .set('Authorization', `Bearer ${adminToken}`);
      return (
        queue.body.data.find(
          (row: { shipmentId: string }) => row.shipmentId === shipmentId,
        ) as { paymentId: string }
      ).paymentId;
    };

    it('menolak alasan yang kurang dari 10 karakter', async () => {
      const shipment = await book();
      await uploadProof(shipment.id, PNG_BYTES);
      const paymentId = await findPaymentId(shipment.id);

      const res = await api()
        .post(`/api/v1/admin/payments/${paymentId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'pendek' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [{ field: 'reason' }],
      });
    });

    it('mengembalikan kiriman ke UNPAID agar customer bisa unggah ulang', async () => {
      const shipment = await book();
      await uploadProof(shipment.id, PNG_BYTES);
      const paymentId = await findPaymentId(shipment.id);

      const res = await api()
        .post(`/api/v1/admin/payments/${paymentId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Nominal transfer tidak sesuai tagihan.' });

      expect(res.status).toBe(200);
      expect(res.body.data.paymentStatus).toBe('UNPAID');
      expect(res.body.data.status).toBe('PENDING_PAYMENT');
      expect(res.body.data.payments[0]).toMatchObject({
        status: 'REJECTED',
        rejectionReason: 'Nominal transfer tidak sesuai tagihan.',
      });

      // Unggah ulang diperbolehkan setelah ditolak.
      const reupload = await uploadProof(shipment.id, PNG_BYTES);
      expect(reupload.status).toBe(201);
      expect(reupload.body.data.paymentStatus).toBe('WAITING_VERIFICATION');
    });

    it('membalas 404 untuk id pembayaran yang tidak ada', async () => {
      const res = await api()
        .post('/api/v1/admin/payments/payment-tidak-ada/reject')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Alasan yang cukup panjang.' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /files/:id', () => {
    let attachmentId: string;

    beforeAll(async () => {
      const shipment = await book();
      const uploaded = await uploadProof(shipment.id, PNG_BYTES);
      attachmentId = uploaded.body.data.payments[0].attachmentId as string;
    });

    it('memberi berkas kepada pemiliknya dengan tipe konten yang benar', async () => {
      const res = await api()
        .get(`/api/v1/files/${attachmentId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/png');
      expect(Buffer.from(res.body as Buffer).equals(PNG_BYTES)).toBe(true);
    });

    it('memberi berkas kepada admin', async () => {
      const res = await api()
        .get(`/api/v1/files/${attachmentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('menolak pengguna lain dengan 403', async () => {
      const res = await api()
        .get(`/api/v1/files/${attachmentId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('menolak tanpa token', async () => {
      const res = await api().get(`/api/v1/files/${attachmentId}`);
      expect(res.status).toBe(401);
    });

    it('membalas 404 untuk berkas yang tidak ada', async () => {
      const res = await api()
        .get('/api/v1/files/berkas-tidak-ada')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
