import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { configureApp } from './../src/setup-app';

const SUFFIX = `@b6e2e-${Date.now()}.test`;
const adminEmail = `admin${SUFFIX}`;
const otherAdminEmail = `admin2${SUFFIX}`;
const customerEmail = `customer${SUFFIX}`;
const agentEmail = `agent${SUFFIX}`;
const doorCode = `B6D${Date.now().toString(36).toUpperCase()}`;
const portCode = `B6P${Date.now().toString(36).toUpperCase()}`;

describe('Admin operations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let otherAdminToken: string;
  let customerToken: string;
  let adminId: string;
  let otherAdminId: string;
  let customerId: string;
  let agentId: string;

  const api = () => request(app.getHttpServer());

  const login = async (email: string, password: string) => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email, password });
    return res.body.data.accessToken as string;
  };

  const createRoute = async (code: string, serviceType: string) => {
    const route = await api()
      .post('/api/v1/admin/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        serviceType,
        destinationCode: code,
        destinationName: `Rute ${code}`,
        destinationRegion: 'Wilayah Uji',
        estimatedDays: 3,
      });
    await api()
      .put(`/api/v1/admin/routes/${route.body.data.id}/rate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pricePerKg: 16_000, minChargeableWeight: 3, baseFee: 10_000 });
  };

  // Booking milik customer, dipakai sebagai bahan uji transisi status.
  const book = async (serviceType = 'PORT_TO_DOOR', weight = 4) => {
    const res = await api()
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        serviceType,
        destinationCode: serviceType === 'PORT_TO_DOOR' ? doorCode : portCode,
        senderName: 'Budi Santoso',
        senderPhone: '0812-3456-7890',
        recipientName: 'Dewi Lestari',
        recipientPhone: '0855-6667-777',
        recipientAddress: 'Jl. Raya Darmo No. 88, Wonokromo',
        recipientCity: 'Surabaya',
        itemDescription: 'Alat elektronik rumah tangga',
        declaredWeight: weight,
        totalColli: 1,
        prohibitedItemsAgreed: true,
      });
    return res.body.data as { id: string; trackingNumber: string };
  };

  const setStatus = (id: string, body: Record<string, unknown>) =>
    api()
      .post(`/api/v1/admin/shipments/${id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    for (const email of [adminEmail, otherAdminEmail]) {
      await prisma.user.create({
        data: {
          email,
          passwordHash: await bcrypt.hash('AdminPassword123', 12),
          fullName: 'B6 E2E Admin',
          phone: '+628110000000',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });
    }
    adminToken = await login(adminEmail, 'AdminPassword123');
    otherAdminToken = await login(otherAdminEmail, 'AdminPassword123');

    await api().post('/api/v1/auth/register').send({
      fullName: 'Customer B6',
      email: customerEmail,
      phone: '0812-0000-0000',
      password: 'Password123',
    });
    customerToken = await login(customerEmail, 'Password123');

    await api().post('/api/v1/auth/register/agent').send({
      fullName: 'Agen B6',
      email: agentEmail,
      phone: '0813-1111-2222',
      password: 'Password123',
      companyName: 'PT Kargo Uji B6',
      companyAddress: 'Jl. Pelabuhan No. 10, Makassar',
      picName: 'PIC Uji',
      picPhone: '0814-5555-6666',
    });

    const users = await prisma.user.findMany({
      where: { email: { endsWith: SUFFIX } },
      select: { id: true, email: true },
    });
    adminId = users.find((u) => u.email === adminEmail)!.id;
    otherAdminId = users.find((u) => u.email === otherAdminEmail)!.id;
    customerId = users.find((u) => u.email === customerEmail)!.id;
    agentId = users.find((u) => u.email === agentEmail)!.id;

    await createRoute(doorCode, 'PORT_TO_DOOR');
    await createRoute(portCode, 'PORT_TO_PORT');
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: SUFFIX } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);

    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.shipment.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.recipient.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.route.deleteMany({
      where: { destinationCode: { in: [doorCode, portCode] } },
    });
    await app.close();
  });

  describe('otorisasi', () => {
    it('seluruh endpoint admin menolak non-admin dengan 403', async () => {
      const paths = [
        '/api/v1/admin/dashboard',
        '/api/v1/admin/shipments',
        '/api/v1/admin/users',
        '/api/v1/admin/agents',
        '/api/v1/admin/audit-logs',
      ];

      for (const path of paths) {
        const res = await api()
          .get(path)
          .set('Authorization', `Bearer ${customerToken}`);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });
  });

  describe('siklus penuh sampai DELIVERED', () => {
    it('menempuh seluruh tahap dan mencatat setiap event', async () => {
      const shipment = await book('PORT_TO_DOOR');

      const paid = await setStatus(shipment.id, { status: 'PAID' });
      expect(paid.status).toBe(200);
      expect(paid.body.data.status).toBe('PAID');

      await setStatus(shipment.id, {
        status: 'RECEIVED_AT_WAREHOUSE',
        notes: 'Barang diterima gudang',
      });
      await setStatus(shipment.id, {
        status: 'IN_TRANSIT',
        location: 'Pelabuhan Tanjung Perak',
      });
      await setStatus(shipment.id, { status: 'ARRIVED_AT_DESTINATION' });
      await setStatus(shipment.id, { status: 'OUT_FOR_DELIVERY' });

      const delivered = await setStatus(shipment.id, {
        status: 'DELIVERED',
        deliveredTo: 'Dewi Lestari',
      });

      expect(delivered.status).toBe(200);
      expect(delivered.body.data.status).toBe('DELIVERED');
      expect(delivered.body.data.deliveredTo).toBe('Dewi Lestari');
      // Satu event awal + enam transisi.
      expect(delivered.body.data.events).toHaveLength(7);

      // Status final menolak perubahan lebih lanjut.
      const after = await setStatus(shipment.id, { status: 'IN_TRANSIT' });
      expect(after.status).toBe(422);
      expect(after.body.error.message).toBe(
        'Kiriman ini sudah berstatus akhir dan tidak dapat diubah lagi.',
      );
    });
  });

  describe('transisi tidak sah ditolak 422', () => {
    it('menyebutkan transisi yang diizinkan', async () => {
      const shipment = await book();

      const res = await setStatus(shipment.id, { status: 'DELIVERED' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('SHIPMENT_INVALID_TRANSITION');
      expect(res.body.error.message).toBe(
        'Status tidak dapat diubah ke sana. Yang diizinkan: PAID, CANCELLED.',
      );
    });

    it('menolak READY_FOR_PICKUP untuk layanan Port to Door', async () => {
      const shipment = await book('PORT_TO_DOOR');
      await setStatus(shipment.id, { status: 'PAID' });
      await setStatus(shipment.id, { status: 'RECEIVED_AT_WAREHOUSE' });
      await setStatus(shipment.id, { status: 'IN_TRANSIT' });
      await setStatus(shipment.id, { status: 'ARRIVED_AT_DESTINATION' });

      const res = await setStatus(shipment.id, { status: 'READY_FOR_PICKUP' });
      expect(res.status).toBe(422);
      expect(res.body.error.message).toContain('OUT_FOR_DELIVERY');
    });

    it('mewajibkan alasan untuk ON_HOLD dan mengembalikan ke status semula', async () => {
      const shipment = await book();
      await setStatus(shipment.id, { status: 'PAID' });
      await setStatus(shipment.id, { status: 'RECEIVED_AT_WAREHOUSE' });

      const noReason = await setStatus(shipment.id, { status: 'ON_HOLD' });
      expect(noReason.status).toBe(422);
      expect(noReason.body.error.message).toBe(
        'Alasan wajib diisi untuk status ini.',
      );

      const held = await setStatus(shipment.id, {
        status: 'ON_HOLD',
        reason: 'Dokumen belum lengkap',
      });
      expect(held.status).toBe(200);
      expect(held.body.data.previousStatus).toBe('RECEIVED_AT_WAREHOUSE');

      // Keluar dari ON_HOLD hanya boleh ke status sebelum tertahan.
      const wrongExit = await setStatus(shipment.id, { status: 'DELIVERED' });
      expect(wrongExit.status).toBe(422);

      const resumed = await setStatus(shipment.id, {
        status: 'RECEIVED_AT_WAREHOUSE',
      });
      expect(resumed.status).toBe(200);
      expect(resumed.body.data.previousStatus).toBeNull();
    });
  });

  describe('aksi massal', () => {
    it('melewati yang gagal alih-alih menggagalkan semuanya', async () => {
      const ok1 = await book();
      const ok2 = await book();
      const alreadyCancelled = await book();

      await api()
        .post(`/api/v1/shipments/${alreadyCancelled.id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      const res = await api()
        .post('/api/v1/admin/shipments/bulk-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          shipmentIds: [
            ok1.id,
            ok2.id,
            alreadyCancelled.id,
            'kiriman-tidak-ada',
          ],
          status: 'PAID',
          notes: 'Pembayaran manual diverifikasi',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.updatedCount).toBe(2);
      expect(res.body.data.skipped).toHaveLength(2);

      const reasons = res.body.data.skipped.map(
        (row: { reason: string }) => row.reason,
      );
      expect(reasons).toContain('Kiriman tidak ditemukan');
      expect(
        reasons.some((reason: string) => reason.includes('berstatus akhir')),
      ).toBe(true);
    });
  });

  describe('koreksi berat', () => {
    it('menghitung ulang memakai snapshot tarif dan mencatat selisih', async () => {
      const shipment = await book('PORT_TO_DOOR', 4);

      // Tarif rute dinaikkan setelah booking — tagihan lama tidak boleh ikut.
      const route = await prisma.route.findFirstOrThrow({
        where: { destinationCode: doorCode },
      });
      await api()
        .put(`/api/v1/admin/routes/${route.id}/rate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ pricePerKg: 99_000, minChargeableWeight: 3, baseFee: 50_000 });

      const res = await api()
        .patch(`/api/v1/admin/shipments/${shipment.id}/weight`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ actualWeight: 6, notes: 'Timbang ulang di gudang' });

      expect(res.status).toBe(200);
      // 6 kg × 16.000 (snapshot) + 10.000 = 106.000, bukan tarif baru.
      expect(res.body.data.shipment.totalAmount).toBe(106_000);
      expect(res.body.data.shipment.chargeableWeight).toBe(6);
      expect(res.body.data.shipment.actualWeight).toBe(6);
      expect(res.body.data.previousChargeableWeight).toBe(4);
      expect(res.body.data.previousTotalAmount).toBe(74_000);
      expect(res.body.data.difference).toBe(32_000);

      // Kembalikan tarif agar tes lain tidak terpengaruh.
      await api()
        .put(`/api/v1/admin/routes/${route.id}/rate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ pricePerKg: 16_000, minChargeableWeight: 3, baseFee: 10_000 });
    });

    it('menolak berat nol dan di atas batas', async () => {
      const shipment = await book();

      const zero = await api()
        .patch(`/api/v1/admin/shipments/${shipment.id}/weight`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ actualWeight: 0 });
      expect(zero.status).toBe(400);
      expect(zero.body.error.code).toBe('VALIDATION_ERROR');

      const tooHeavy = await api()
        .patch(`/api/v1/admin/shipments/${shipment.id}/weight`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ actualWeight: 1500 });
      expect(tooHeavy.status).toBe(400);
      expect(tooHeavy.body.error.code).toBe('WEIGHT_EXCEEDS_LIMIT');
    });
  });

  describe('booking walk-in', () => {
    it('membuat kiriman atas nama customer dan mencatat audit', async () => {
      const res = await api()
        .post('/api/v1/admin/shipments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          serviceType: 'PORT_TO_DOOR',
          destinationCode: doorCode,
          onBehalfOfUserId: customerId,
          senderName: 'Pelanggan Walk In',
          senderPhone: '0812-9999-8888',
          recipientName: 'Penerima Walk In',
          recipientPhone: '0855-1111-2222',
          recipientAddress: 'Jl. Panglima Sudirman No. 1, Surabaya',
          recipientCity: 'Surabaya',
          itemDescription: 'Dokumen penting',
          declaredWeight: 4,
          totalColli: 1,
          prohibitedItemsAgreed: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.customerId).toBe(customerId);
      expect(res.body.data.customerEmail).toBe(customerEmail);
      expect(res.body.data.events[0].notes).toBe(
        'Booking dibuat admin atas nama customer',
      );
    });

    it('membalas 404 untuk akun customer yang tidak ada', async () => {
      const res = await api()
        .post('/api/v1/admin/shipments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          serviceType: 'PORT_TO_DOOR',
          destinationCode: doorCode,
          onBehalfOfUserId: 'user-tidak-ada',
          senderName: 'Pelanggan Walk In',
          senderPhone: '0812-9999-8888',
          recipientName: 'Penerima Walk In',
          recipientPhone: '0855-1111-2222',
          recipientAddress: 'Jl. Panglima Sudirman No. 1, Surabaya',
          recipientCity: 'Surabaya',
          itemDescription: 'Dokumen penting',
          declaredWeight: 4,
          totalColli: 1,
          prohibitedItemsAgreed: true,
        });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Akun customer tidak ditemukan.');
    });
  });

  describe('daftar & detail kiriman admin', () => {
    it('menyaring dan menyertakan identitas pemesan', async () => {
      const res = await api()
        .get(`/api/v1/admin/shipments?destinationCode=${doorCode}&limit=100`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toMatchObject({
        customerId: expect.any(String),
        customerName: expect.any(String),
        customerEmail: expect.any(String),
        daysSinceUpdate: expect.any(Number),
      });
    });

    it('detail menerima id maupun nomor resi', async () => {
      const shipment = await book();

      const byId = await api()
        .get(`/api/v1/admin/shipments/${shipment.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(byId.status).toBe(200);

      const byTracking = await api()
        .get(`/api/v1/admin/shipments/${shipment.trackingNumber}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(byTracking.status).toBe(200);
      expect(byTracking.body.data.id).toBe(shipment.id);
    });
  });

  describe('approval agen', () => {
    it('menyetujui agen lalu menolak persetujuan ulang dengan 409', async () => {
      const approved = await api()
        .post(`/api/v1/admin/agents/${agentId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      expect(approved.status).toBe(200);
      expect(approved.body.data.approvalStatus).toBe('APPROVED');

      const again = await api()
        .post(`/api/v1/admin/agents/${agentId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();
      expect(again.status).toBe(409);
      expect(again.body.error.message).toBe(
        'Agen ini sudah disetujui sebelumnya.',
      );
    });

    it('menolak agen dengan alasan minimal 10 karakter', async () => {
      const tooShort = await api()
        .post(`/api/v1/admin/agents/${agentId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'pendek' });

      expect(tooShort.status).toBe(400);
      expect(tooShort.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [{ field: 'reason' }],
      });

      const rejected = await api()
        .post(`/api/v1/admin/agents/${agentId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Dokumen perusahaan belum lengkap.' });

      expect(rejected.status).toBe(200);
      expect(rejected.body.data.approvalStatus).toBe('REJECTED');

      const profile = await prisma.agentProfile.findUniqueOrThrow({
        where: { userId: agentId },
      });
      expect(profile.rejectionReason).toBe('Dokumen perusahaan belum lengkap.');
      expect(profile.reviewedBy).toBe(adminId);
      expect(profile.reviewedAt).not.toBeNull();
    });

    it('membalas 404 untuk agen yang tidak ada', async () => {
      const res = await api()
        .post(`/api/v1/admin/agents/${customerId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Agen tidak ditemukan.');
    });
  });

  describe('kelola user', () => {
    it('menampilkan jumlah kiriman dan menyaring berdasarkan role', async () => {
      const res = await api()
        .get('/api/v1/admin/users?role=CUSTOMER&limit=100')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const found = res.body.data.find(
        (row: { email: string }) => row.email === customerEmail,
      ) as { shipmentCount: number };
      expect(found.shipmentCount).toBeGreaterThan(0);
    });

    it('detail user memuat ringkasan status dan kiriman terakhir', async () => {
      const res = await api()
        .get(`/api/v1/admin/users/${customerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.statusCounts).toBeDefined();
      expect(res.body.data.recentShipments.length).toBeGreaterThan(0);
      expect(res.body.data.recentShipments.length).toBeLessThanOrEqual(5);
      // Bentuk ringkas: tanpa items/events.
      expect(res.body.data.recentShipments[0]).not.toHaveProperty('items');
    });

    it('admin tidak dapat mengubah status akunnya sendiri', async () => {
      const res = await api()
        .patch(`/api/v1/admin/users/${adminId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toBe(
        'Anda tidak dapat mengubah status akun Anda sendiri.',
      );
    });

    it('dapat menangguhkan akun lain', async () => {
      const res = await api()
        .patch(`/api/v1/admin/users/${otherAdminId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SUSPENDED');

      // Kembalikan agar tidak mengganggu tes lain.
      await api()
        .patch(`/api/v1/admin/users/${otherAdminId}/status`)
        .set('Authorization', `Bearer ${otherAdminToken}`)
        .send({ status: 'ACTIVE' })
        .catch(() => undefined);
      await prisma.user.update({
        where: { id: otherAdminId },
        data: { status: 'ACTIVE' },
      });
    });

    it('menolak status yang tidak dikenal', async () => {
      const res = await api()
        .patch(`/api/v1/admin/users/${customerId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ENTAH' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('dashboard admin', () => {
    it('merangkum antrean kerja operasional', async () => {
      const res = await api()
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        pendingPaymentVerification: expect.any(Number),
        pendingAgentApproval: expect.any(Number),
        stalledShipments: expect.any(Number),
        totalShipments: expect.any(Number),
        activeShipments: expect.any(Number),
      });
      expect(Array.isArray(res.body.data.needsAttention)).toBe(true);
      expect(res.body.data.needsAttention.length).toBeLessThanOrEqual(8);
      expect(res.body.data.statusCounts).toBeDefined();
    });
  });

  describe('audit log', () => {
    it('mencatat setiap aksi admin yang mengubah keadaan', async () => {
      const res = await api()
        .get('/api/v1/admin/audit-logs?limit=100')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const actions = res.body.data.map(
        (row: { action: string }) => row.action,
      );

      // Setiap milestone yang menulis audit harus terwakili.
      expect(actions).toContain('SHIPMENT_STATUS_CHANGED');
      expect(actions).toContain('SHIPMENT_WEIGHT_CORRECTED');
      expect(actions).toContain('SHIPMENT_CREATED_BY_ADMIN');
      expect(actions).toContain('AGENT_APPROVED');
      expect(actions).toContain('AGENT_REJECTED');
      expect(actions).toContain('USER_STATUS_CHANGED');
      expect(actions).toContain('ROUTE_CREATED');
      expect(actions).toContain('RATE_UPDATED');

      // Terbaru lebih dulu, dan pelakunya tercatat.
      expect(res.body.data[0]).toMatchObject({
        actorEmail: expect.any(String),
        actorName: expect.any(String),
        entityType: expect.any(String),
        entityLabel: expect.any(String),
      });
      expect(res.body.data[0]).not.toHaveProperty('actorId');
    });

    it('dapat disaring berdasarkan jenis aksi', async () => {
      const res = await api()
        .get('/api/v1/admin/audit-logs?action=AGENT_APPROVED')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.limit).toBe(30);
      for (const row of res.body.data as Array<{ action: string }>) {
        expect(row.action).toBe('AGENT_APPROVED');
      }
    });

    it('mencatat perubahan status dengan nilai sebelum dan sesudah', async () => {
      const res = await api()
        .get('/api/v1/admin/audit-logs?action=SHIPMENT_STATUS_CHANGED')
        .set('Authorization', `Bearer ${adminToken}`);

      const entry = res.body.data[0] as {
        before: { status: string };
        after: { status: string };
      };
      expect(entry.before.status).toEqual(expect.any(String));
      expect(entry.after.status).toEqual(expect.any(String));
    });
  });
});
