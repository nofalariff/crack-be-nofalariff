import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { configureApp } from './../src/setup-app';

const SUFFIX = `@b4e2e-${Date.now()}.test`;
const adminEmail = `admin${SUFFIX}`;
const customerEmail = `customer${SUFFIX}`;
const otherCustomerEmail = `other${SUFFIX}`;
const pendingAgentEmail = `pendingagent${SUFFIX}`;
const destinationCode = `B4E2E${Date.now().toString(36).toUpperCase()}`;

const booking = {
  serviceType: 'PORT_TO_DOOR',
  destinationCode,
  senderName: 'Budi Santoso',
  senderPhone: '0812-3456-7890',
  recipientName: 'Dewi Lestari',
  recipientPhone: '0855-6667-777',
  recipientAddress: 'Jl. Raya Darmo No. 88, Wonokromo',
  recipientCity: 'Surabaya',
  recipientPostalCode: '60241',
  itemDescription: 'Alat elektronik rumah tangga',
  declaredWeight: 4,
  totalColli: 1,
  declaredValue: 2_000_000,
  prohibitedItemsAgreed: true,
};

describe('Shipments (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let customerToken: string;
  let otherToken: string;
  let pendingAgentToken: string;

  const api = () => request(app.getHttpServer());

  const login = async (email: string, password: string) => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email, password });
    return res.body.data.accessToken as string;
  };

  const registerCustomer = async (email: string) => {
    await api().post('/api/v1/auth/register').send({
      fullName: 'Pengguna Uji B4',
      email,
      phone: '0812-0000-0000',
      password: 'Password123',
    });
    return login(email, 'Password123');
  };

  const book = (token: string, overrides: Record<string, unknown> = {}) =>
    api()
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...booking, ...overrides });

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
        fullName: 'B4 E2E Admin',
        phone: '+628110000000',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    adminToken = await login(adminEmail, 'AdminPassword123');

    customerToken = await registerCustomer(customerEmail);
    otherToken = await registerCustomer(otherCustomerEmail);

    // Agen baru selalu berstatus PENDING sampai disetujui admin (B6).
    await api().post('/api/v1/auth/register/agent').send({
      fullName: 'Agen Menunggu',
      email: pendingAgentEmail,
      phone: '0813-1111-2222',
      password: 'Password123',
      companyName: 'PT Kargo Uji',
      companyAddress: 'Jl. Pelabuhan No. 10, Makassar',
      picName: 'PIC Uji',
      picPhone: '0814-5555-6666',
    });
    pendingAgentToken = await login(pendingAgentEmail, 'Password123');

    const route = await api()
      .post('/api/v1/admin/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        serviceType: 'PORT_TO_DOOR',
        destinationCode,
        destinationName: 'Rute Uji B4',
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

    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.shipment.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.recipient.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.route.deleteMany({ where: { destinationCode } });
    await app.close();
  });

  describe('POST /shipments — booking', () => {
    it('membuat kiriman dengan nomor resi, snapshot tarif, dan satu event awal', async () => {
      const res = await book(customerToken);

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        serviceType: 'PORT_TO_DOOR',
        destinationCode,
        destinationName: 'Rute Uji B4',
        status: 'PENDING_PAYMENT',
        paymentStatus: 'UNPAID',
        chargeableWeight: 4,
        pricePerKgSnapshot: 16_000,
        baseFeeSnapshot: 10_000,
        totalAmount: 74_000,
        outstandingAmount: 74_000,
        estimatedDays: 3,
        actualWeight: null,
        cancelReason: null,
        deliveredTo: null,
      });

      expect(res.body.data.trackingNumber).toMatch(
        /^LGS-\d{6}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/,
      );
      // Nomor HP dinormalkan ke +62 di server.
      expect(res.body.data.senderPhone).toBe('+6281234567890');
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0]).toMatchObject({
        description: 'Alat elektronik rumah tangga',
        quantity: 1,
        weight: 4,
        declaredValue: 2_000_000,
      });
      expect(res.body.data.events).toHaveLength(1);
      expect(res.body.data.events[0]).toMatchObject({
        status: 'PENDING_PAYMENT',
        notes: 'Booking dibuat',
      });
      // userId & previousStatus tidak ikut bocor ke response.
      expect(res.body.data).not.toHaveProperty('userId');
      expect(res.body.data).not.toHaveProperty('previousStatus');
    });

    it('menolak booking tanpa persetujuan barang terlarang', async () => {
      const res = await book(customerToken, { prohibitedItemsAgreed: false });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PROHIBITED_ITEMS_NOT_AGREED');
    });

    it('menolak berat di atas 1000 kg', async () => {
      const res = await book(customerToken, { declaredWeight: 1500 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('WEIGHT_EXCEEDS_LIMIT');
    });

    it('menolak berat nol atau negatif', async () => {
      const res = await book(customerToken, { declaredWeight: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('menolak tujuan yang tidak dilayani', async () => {
      const res = await book(customerToken, {
        destinationCode: 'TIDAK_ADA_RUTE',
      });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ROUTE_NOT_SERVED');
    });

    it('menolak agen yang belum disetujui', async () => {
      const res = await book(pendingAgentToken);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AGENT_NOT_APPROVED');
    });

    it('menyimpan penerima ke buku alamat bila diminta', async () => {
      const before = await api()
        .get('/api/v1/recipients')
        .set('Authorization', `Bearer ${customerToken}`);

      await book(customerToken, { saveRecipient: true });

      const after = await api()
        .get('/api/v1/recipients')
        .set('Authorization', `Bearer ${customerToken}`);

      const countBefore = (before.body.data as unknown[]).length;
      expect(after.body.data).toHaveLength(countBefore + 1);
      expect(after.body.data[0]).toMatchObject({
        name: 'Dewi Lestari',
        city: 'Surabaya',
        label: null,
      });
    });
  });

  describe('GET /shipments — daftar', () => {
    it('hanya menampilkan kiriman milik sendiri, dengan meta paginasi', async () => {
      const res = await api()
        .get('/api/v1/shipments')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 20 });
      expect(res.body.data.length).toBeGreaterThan(0);
      // Bentuk ringkas: tanpa items/events/userId.
      expect(res.body.data[0]).not.toHaveProperty('items');
      expect(res.body.data[0]).not.toHaveProperty('userId');
      expect(res.body.data[0]).toHaveProperty('totalAmount');
    });

    it('daftar customer lain kosong — data tidak bocor antar pemilik', async () => {
      const res = await api()
        .get('/api/v1/shipments')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });

    it('menyaring berdasarkan status dan mencari berdasarkan nama penerima', async () => {
      const byStatus = await api()
        .get('/api/v1/shipments?status=PENDING_PAYMENT')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(byStatus.body.data.length).toBeGreaterThan(0);

      const bySearch = await api()
        .get('/api/v1/shipments?search=dewi')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(bySearch.body.data.length).toBeGreaterThan(0);

      const noMatch = await api()
        .get('/api/v1/shipments?search=tidakadanama')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(noMatch.body.data).toHaveLength(0);
    });
  });

  describe('GET /shipments/:trackingNumber — detail', () => {
    it('menemukan kiriman walau huruf kecil dan tanpa tanda hubung', async () => {
      const created = await book(customerToken);
      const trackingNumber = created.body.data.trackingNumber as string;

      const exact = await api()
        .get(`/api/v1/shipments/${trackingNumber}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(exact.status).toBe(200);
      expect(exact.body.data.trackingNumber).toBe(trackingNumber);

      const messy = trackingNumber.toLowerCase().replace(/-/g, '');
      const relaxed = await api()
        .get(`/api/v1/shipments/${messy}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(relaxed.status).toBe(200);
      expect(relaxed.body.data.trackingNumber).toBe(trackingNumber);
    });

    it('membalas 404 (bukan 403) untuk kiriman milik orang lain', async () => {
      const created = await book(customerToken);
      const trackingNumber = created.body.data.trackingNumber as string;

      const res = await api()
        .get(`/api/v1/shipments/${trackingNumber}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /shipments/:id', () => {
    it('mengubah data penerima, mengabaikan string kosong', async () => {
      const created = await book(customerToken);
      const id = created.body.data.id as string;

      const res = await api()
        .patch(`/api/v1/shipments/${id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          recipientName: 'Dewi Lestari Updated',
          recipientCity: '',
          itemDescription: 'Barang pecah belah',
          notes: '',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.recipientName).toBe('Dewi Lestari Updated');
      expect(res.body.data.recipientCity).toBe('Surabaya');
      expect(res.body.data.items[0].description).toBe('Barang pecah belah');
      // notes string kosong mengosongkan nilainya.
      expect(res.body.data.notes).toBeNull();
    });

    it('menolak perubahan milik orang lain dengan 404', async () => {
      const created = await book(customerToken);

      const res = await api()
        .patch(`/api/v1/shipments/${created.body.data.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ recipientName: 'Diretas' });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /shipments/:id/cancel', () => {
    it('membatalkan kiriman yang belum dibayar dan menambah event', async () => {
      const created = await book(customerToken);
      const id = created.body.data.id as string;

      const res = await api()
        .post(`/api/v1/shipments/${id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Salah memilih tujuan' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
      expect(res.body.data.cancelReason).toBe('Salah memilih tujuan');
      expect(res.body.data.events[0]).toMatchObject({
        status: 'CANCELLED',
        notes: 'Salah memilih tujuan',
      });
    });

    it('memakai alasan bawaan bila tidak diisi', async () => {
      const created = await book(customerToken);

      const res = await api()
        .post(`/api/v1/shipments/${created.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.cancelReason).toBe('Dibatalkan oleh pemesan');
    });

    it('menolak pembatalan kedua kali dengan 409', async () => {
      const created = await book(customerToken);
      const id = created.body.data.id as string;

      await api()
        .post(`/api/v1/shipments/${id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      const res = await api()
        .post(`/api/v1/shipments/${id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SHIPMENT_NOT_CANCELLABLE');
    });

    it('kiriman yang sudah dibatalkan tidak dapat diubah lagi', async () => {
      const created = await book(customerToken);
      const id = created.body.data.id as string;

      await api()
        .post(`/api/v1/shipments/${id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      const res = await api()
        .patch(`/api/v1/shipments/${id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ recipientName: 'Nama Baru' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SHIPMENT_NOT_EDITABLE');
    });
  });

  describe('POST /shipments/:id/duplicate', () => {
    it('membuat kiriman baru dengan resi berbeda dan status awal', async () => {
      const created = await book(customerToken);
      const source = created.body.data;

      const res = await api()
        .post(`/api/v1/shipments/${source.id}/duplicate`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send();

      expect(res.status).toBe(201);
      expect(res.body.data.id).not.toBe(source.id);
      expect(res.body.data.trackingNumber).not.toBe(source.trackingNumber);
      expect(res.body.data.status).toBe('PENDING_PAYMENT');
      expect(res.body.data.recipientName).toBe(source.recipientName);
      expect(res.body.data.totalAmount).toBe(source.totalAmount);
      expect(res.body.data.events).toHaveLength(1);
    });

    it('menolak duplikat milik orang lain dengan 404', async () => {
      const created = await book(customerToken);

      const res = await api()
        .post(`/api/v1/shipments/${created.body.data.id}/duplicate`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send();

      expect(res.status).toBe(404);
    });
  });

  describe('tarif lama tidak berubah saat tarif rute diubah', () => {
    it('kiriman lama tetap memakai snapshot tarifnya', async () => {
      const created = await book(customerToken);
      const trackingNumber = created.body.data.trackingNumber as string;
      const routeId = (
        await prisma.route.findFirstOrThrow({ where: { destinationCode } })
      ).id;

      await api()
        .put(`/api/v1/admin/routes/${routeId}/rate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ pricePerKg: 99_000, minChargeableWeight: 3, baseFee: 50_000 });

      const res = await api()
        .get(`/api/v1/shipments/${trackingNumber}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.body.data.pricePerKgSnapshot).toBe(16_000);
      expect(res.body.data.totalAmount).toBe(74_000);

      // Kembalikan tarif agar tes lain tidak terpengaruh.
      await api()
        .put(`/api/v1/admin/routes/${routeId}/rate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ pricePerKg: 16_000, minChargeableWeight: 3, baseFee: 10_000 });
    });
  });

  describe('GET /dashboard/summary', () => {
    it('menghitung ringkasan kiriman milik sendiri', async () => {
      const res = await api()
        .get('/api/v1/dashboard/summary')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalShipments).toBeGreaterThan(0);
      expect(res.body.data.awaitingPaymentCount).toBeGreaterThan(0);
      expect(res.body.data.recentShipments.length).toBeLessThanOrEqual(5);
      expect(res.body.data.statusCounts).toHaveProperty('PENDING_PAYMENT');
    });

    it('ringkasan customer lain tetap kosong', async () => {
      const res = await api()
        .get('/api/v1/dashboard/summary')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.body.data.totalShipments).toBe(0);
      expect(res.body.data.recentShipments).toHaveLength(0);
    });
  });

  describe('Recipients (buku alamat)', () => {
    let recipientId: string;

    it('menambah penerima baru', async () => {
      const res = await api()
        .post('/api/v1/recipients')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          label: 'Rumah Ibu',
          name: 'Hasan Basri',
          phone: '0822-3334-444',
          address: 'Jl. Perintis Kemerdekaan KM 10 No. 21',
          city: 'Makassar',
          postalCode: '90245',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        label: 'Rumah Ibu',
        name: 'Hasan Basri',
        phone: '+628223334444',
        city: 'Makassar',
      });
      recipientId = res.body.data.id as string;
    });

    it('mengubah penerima, string kosong mengosongkan label', async () => {
      const res = await api()
        .patch(`/api/v1/recipients/${recipientId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ label: '', city: 'Gowa' });

      expect(res.status).toBe(200);
      expect(res.body.data.label).toBeNull();
      expect(res.body.data.city).toBe('Gowa');
    });

    it('menolak akses penerima milik orang lain dengan 404', async () => {
      const res = await api()
        .patch(`/api/v1/recipients/${recipientId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ city: 'Diretas' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('menghapus penerima tanpa mengubah kiriman yang sudah dibuat', async () => {
      const shipmentsBefore = await api()
        .get('/api/v1/shipments')
        .set('Authorization', `Bearer ${customerToken}`);

      const res = await api()
        .delete(`/api/v1/recipients/${recipientId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: null });

      const shipmentsAfter = await api()
        .get('/api/v1/shipments')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(shipmentsAfter.body.meta.total).toBe(
        shipmentsBefore.body.meta.total,
      );
    });
  });
});
