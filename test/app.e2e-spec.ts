import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/setup-app';

interface SuccessEnvelope {
  success: true;
  data: Record<string, unknown>;
}

interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string };
}

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('/health (GET) balas envelope sukses', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res: { body: SuccessEnvelope }) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('status');
        expect(res.body.data).toHaveProperty('database');
      });
  });

  it('rute tidak dikenal balas envelope error NOT_FOUND', () => {
    return request(app.getHttpServer())
      .get('/api/v1/does-not-exist')
      .expect(404)
      .expect((res: { body: ErrorEnvelope }) => {
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('NOT_FOUND');
        expect(typeof res.body.error.message).toBe('string');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
