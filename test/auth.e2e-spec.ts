import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { configureApp } from './../src/setup-app';

const EMAIL_SUFFIX = `@b2e2e-${Date.now()}.test`;
const customerEmail = `customer${EMAIL_SUFFIX}`;
const agentEmail = `agent${EMAIL_SUFFIX}`;

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: EMAIL_SUFFIX } },
    });
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  describe('registrasi', () => {
    it('registrasi customer mengembalikan 201 tanpa token', async () => {
      const res = await api().post('/api/v1/auth/register').send({
        fullName: 'Budi Customer',
        email: customerEmail,
        phone: '0812-3456-7890',
        password: 'Password123',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        email: customerEmail,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        agentProfile: null,
      });
      expect(res.body.data).not.toHaveProperty('accessToken');
      expect(res.body.data).not.toHaveProperty('passwordHash');
    });

    it('registrasi agen mengembalikan agentProfile berstatus PENDING', async () => {
      const res = await api().post('/api/v1/auth/register/agent').send({
        fullName: 'Agen Test',
        email: agentEmail,
        phone: '0813-1111-2222',
        password: 'Password123',
        companyName: 'PT Kargo Test',
        companyAddress: 'Jl. Pelabuhan No. 10, Makassar',
        picName: 'PIC Testing',
        picPhone: '0814-5555-6666',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.role).toBe('AGENT');
      expect(res.body.data.agentProfile).toMatchObject({
        approvalStatus: 'PENDING',
        rejectionReason: null,
      });
    });

    it('email yang sudah terdaftar ditolak 400 VALIDATION_ERROR', async () => {
      const res = await api().post('/api/v1/auth/register').send({
        fullName: 'Budi Duplikat',
        email: customerEmail,
        phone: '0812-3456-7890',
        password: 'Password123',
      });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          details: [{ field: 'email' }],
        },
      });
    });

    it('password lemah ditolak dengan detail per field', async () => {
      const res = await api()
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Test Lemah',
          email: `weak${EMAIL_SUFFIX}`,
          phone: '0812-3456-7890',
          password: 'weak',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(
        res.body.error.details.some(
          (d: { field: string }) => d.field === 'password',
        ),
      ).toBe(true);
    });
  });

  describe('login', () => {
    it('login benar mengembalikan token dan user', async () => {
      const res = await api()
        .post('/api/v1/auth/login')
        .send({ email: customerEmail, password: 'Password123' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.expiresIn).toBe(900);
      expect(res.body.data.user.email).toBe(customerEmail);
    });

    it('password salah ditolak 401 AUTH_INVALID_CREDENTIALS', async () => {
      const res = await api()
        .post('/api/v1/auth/login')
        .send({ email: customerEmail, password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('email tidak terdaftar juga membalas kode yang sama (tidak membocorkan info)', async () => {
      const res = await api()
        .post('/api/v1/auth/login')
        .send({ email: `nobody${EMAIL_SUFFIX}`, password: 'whatever123' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    });
  });

  describe('endpoint terlindungi', () => {
    it('menolak tanpa token', async () => {
      const res = await api().get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('menolak token yang salah/rusak', async () => {
      const res = await api()
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('menerima token yang valid', async () => {
      const login = await api()
        .post('/api/v1/auth/login')
        .send({ email: customerEmail, password: 'Password123' });

      const res = await api()
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(customerEmail);
    });
  });

  describe('PATCH /auth/me', () => {
    it('memperbarui fullName, mengabaikan phone kosong', async () => {
      const login = await api()
        .post('/api/v1/auth/login')
        .send({ email: customerEmail, password: 'Password123' });
      const token = login.body.data.accessToken as string;
      const originalPhone = login.body.data.user.phone as string;

      const res = await api()
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ fullName: 'Budi Updated', phone: '' });

      expect(res.status).toBe(200);
      expect(res.body.data.fullName).toBe('Budi Updated');
      expect(res.body.data.phone).toBe(originalPhone);
    });
  });

  describe('refresh & logout', () => {
    it('rotasi token dan menolak token lama yang sudah dipakai', async () => {
      const login = await api()
        .post('/api/v1/auth/login')
        .send({ email: customerEmail, password: 'Password123' });
      const oldRefresh = login.body.data.refreshToken as string;

      const refreshed = await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: oldRefresh });

      expect(refreshed.status).toBe(200);
      expect(refreshed.body.data).not.toHaveProperty('user');
      expect(refreshed.body.data.refreshToken).not.toBe(oldRefresh);

      const reused = await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: oldRefresh });
      expect(reused.status).toBe(401);
      expect(reused.body.error.code).toBe('UNAUTHORIZED');
    });

    it('logout mencabut refresh token sesi tersebut', async () => {
      const login = await api()
        .post('/api/v1/auth/login')
        .send({ email: customerEmail, password: 'Password123' });
      const { accessToken, refreshToken } = login.body.data;

      const logoutRes = await api()
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });
      expect(logoutRes.status).toBe(200);

      const afterLogout = await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });
      expect(afterLogout.status).toBe(401);
    });
  });

  describe('change-password', () => {
    it('menolak jika currentPassword salah', async () => {
      const login = await api()
        .post('/api/v1/auth/login')
        .send({ email: customerEmail, password: 'Password123' });

      const res = await api()
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`)
        .send({
          currentPassword: 'salah-password',
          newPassword: 'Password456',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details[0].field).toBe('currentPassword');
    });

    it('berhasil mengganti password dan mencabut seluruh sesi', async () => {
      const login = await api()
        .post('/api/v1/auth/login')
        .send({ email: customerEmail, password: 'Password123' });
      const { accessToken, refreshToken } = login.body.data;

      const changeRes = await api()
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'Password123', newPassword: 'Password456' });
      expect(changeRes.status).toBe(200);

      const oldRefreshAttempt = await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });
      expect(oldRefreshAttempt.status).toBe(401);

      const oldPasswordLogin = await api()
        .post('/api/v1/auth/login')
        .send({ email: customerEmail, password: 'Password123' });
      expect(oldPasswordLogin.status).toBe(401);

      const newPasswordLogin = await api()
        .post('/api/v1/auth/login')
        .send({ email: customerEmail, password: 'Password456' });
      expect(newPasswordLogin.status).toBe(200);
    });
  });
});
