import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { configureApp } from './../src/setup-app';

const SUFFIX = `@b3e2e-${Date.now()}.test`;
const adminEmail = `admin${SUFFIX}`;
const customerEmail = `customer${SUFFIX}`;
const destinationCode = `B3E2E${Date.now().toString(36).toUpperCase()}`;

describe('Routes & Rates (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let customerToken: string;
  let routeId: string;

  const api = () => request(app.getHttpServer());

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
        fullName: 'B3 E2E Admin',
        phone: '+628110000000',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    const adminLogin = await api()
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: 'AdminPassword123' });
    adminToken = adminLogin.body.data.accessToken as string;

    await api().post('/api/v1/auth/register').send({
      fullName: 'B3 E2E Customer',
      email: customerEmail,
      phone: '0812-0000-0000',
      password: 'Password123',
    });
    const customerLogin = await api()
      .post('/api/v1/auth/login')
      .send({ email: customerEmail, password: 'Password123' });
    customerToken = customerLogin.body.data.accessToken as string;
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: SUFFIX } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);

    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.route.deleteMany({ where: { destinationCode } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  describe('admin/routes — otorisasi', () => {
    it('menolak tanpa token', async () => {
      const res = await api().get('/api/v1/admin/routes');
      expect(res.status).toBe(401);
    });

    it('menolak role non-admin', async () => {
      const res = await api()
        .get('/api/v1/admin/routes')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /admin/routes', () => {
    it('membuat rute tanpa tarif (default pricePerKg 0, minChargeableWeight 1)', async () => {
      const res = await api()
        .post('/api/v1/admin/routes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          serviceType: 'PORT_TO_DOOR',
          destinationCode: destinationCode.toLowerCase(),
          destinationName: 'Rute Uji B3',
          destinationRegion: 'Wilayah Uji',
          estimatedDays: 3,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        destinationCode, // harus di-uppercase
        pricePerKg: 0,
        minChargeableWeight: 1,
        baseFee: 0,
        isActive: true,
        activeShipmentCount: 0,
      });
      routeId = res.body.data.id as string;
    });

    it('menolak kombinasi serviceType + destinationCode yang duplikat', async () => {
      const res = await api()
        .post('/api/v1/admin/routes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          serviceType: 'PORT_TO_DOOR',
          destinationCode,
          destinationName: 'Rute Uji Duplikat',
          destinationRegion: 'Wilayah Uji',
          estimatedDays: 2,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [{ field: 'destinationCode' }],
      });
    });
  });

  describe('GET /routes (publik)', () => {
    it('menampilkan rute baru dengan pricePerKg 0 sebelum tarif diatur', async () => {
      const res = await api().get(`/api/v1/routes?serviceType=PORT_TO_DOOR`);
      expect(res.status).toBe(200);
      const found = res.body.data.find(
        (r: { destinationCode: string }) =>
          r.destinationCode === destinationCode,
      );
      expect(found).toMatchObject({ pricePerKg: 0 });
    });
  });

  describe('PATCH /admin/routes/:id', () => {
    it('memperbarui destinationName, mengabaikan estimatedDays kosong', async () => {
      const res = await api()
        .patch(`/api/v1/admin/routes/${routeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ destinationName: 'Rute Uji B3 (updated)' });

      expect(res.status).toBe(200);
      expect(res.body.data.destinationName).toBe('Rute Uji B3 (updated)');
      expect(res.body.data.estimatedDays).toBe(3);
    });

    it('membalas 404 untuk id yang tidak ada', async () => {
      const res = await api()
        .patch('/api/v1/admin/routes/route-tidak-ada')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ destinationName: 'x' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PUT /admin/routes/:id/rate', () => {
    it('menolak pricePerKg <= 0', async () => {
      const res = await api()
        .put(`/api/v1/admin/routes/${routeId}/rate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ pricePerKg: 0, minChargeableWeight: 3, baseFee: 10_000 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('menetapkan tarif baru dan menonaktifkan tarif lama (riwayat)', async () => {
      const res = await api()
        .put(`/api/v1/admin/routes/${routeId}/rate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ pricePerKg: 16_000, minChargeableWeight: 3, baseFee: 10_000 });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        pricePerKg: 16_000,
        minChargeableWeight: 3,
        baseFee: 10_000,
      });

      const rates = await prisma.rate.findMany({ where: { routeId } });
      expect(rates).toHaveLength(1);
      expect(rates[0].isActive).toBe(true);

      // Set tarif kedua kali — baris lama harus dinonaktifkan, bukan dihapus.
      await api()
        .put(`/api/v1/admin/routes/${routeId}/rate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ pricePerKg: 20_000, minChargeableWeight: 3, baseFee: 10_000 });

      const ratesAfter = await prisma.rate.findMany({
        where: { routeId },
        orderBy: { createdAt: 'asc' },
      });
      expect(ratesAfter).toHaveLength(2);
      expect(ratesAfter[0].isActive).toBe(false);
      expect(ratesAfter[1].isActive).toBe(true);
      expect(Number(ratesAfter[1].pricePerKg)).toBe(20_000);
    });
  });

  describe('POST /rates/calculate', () => {
    it('menghitung ongkir sesuai formula (4 kg, min 3, harga 20000, base 10000)', async () => {
      const res = await api().post('/api/v1/rates/calculate').send({
        serviceType: 'PORT_TO_DOOR',
        destinationCode,
        weight: 4,
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        chargeableWeight: 4,
        pricePerKg: 20_000,
        weightFee: 80_000,
        baseFee: 10_000,
        total: 90_000,
      });
    });

    it('menegakkan berat minimum rute', async () => {
      const res = await api().post('/api/v1/rates/calculate').send({
        serviceType: 'PORT_TO_DOOR',
        destinationCode,
        weight: 0.5,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.chargeableWeight).toBe(3);
    });

    it('menolak berat <= 0', async () => {
      const res = await api().post('/api/v1/rates/calculate').send({
        serviceType: 'PORT_TO_DOOR',
        destinationCode,
        weight: 0,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [{ field: 'weight' }],
      });
    });

    it('menolak berat di atas 1000 kg', async () => {
      const res = await api().post('/api/v1/rates/calculate').send({
        serviceType: 'PORT_TO_DOOR',
        destinationCode,
        weight: 1500,
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('WEIGHT_EXCEEDS_LIMIT');
    });

    it('rute yang tidak dikenal membalas ROUTE_NOT_SERVED', async () => {
      const res = await api().post('/api/v1/rates/calculate').send({
        serviceType: 'PORT_TO_DOOR',
        destinationCode: 'TIDAK_ADA_RUTE',
        weight: 4,
      });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ROUTE_NOT_SERVED');
    });

    it('rute yang dinonaktifkan membalas ROUTE_INACTIVE', async () => {
      await api()
        .patch(`/api/v1/admin/routes/${routeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      const res = await api().post('/api/v1/rates/calculate').send({
        serviceType: 'PORT_TO_DOOR',
        destinationCode,
        weight: 4,
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ROUTE_INACTIVE');

      const listRes = await api().get('/api/v1/routes');
      expect(
        listRes.body.data.find(
          (r: { destinationCode: string }) =>
            r.destinationCode === destinationCode,
        ),
      ).toBeUndefined();
    });
  });
});
