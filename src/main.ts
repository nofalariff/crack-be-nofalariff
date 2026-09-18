import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './setup-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Di belakang reverse proxy (Railway), percayai satu hop agar req.ip adalah
  // IP klien — tanpa ini rate limit per IP berlaku untuk semua pengguna sekaligus.
  app.set('trust proxy', 1);
  app.enableShutdownHooks();

  configureApp(app);

  if (config.get<boolean>('SWAGGER_ENABLED')) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('LogiSend API')
      .setDescription('Dokumentasi REST API LogiSend')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
  Logger.log(
    `LogiSend API berjalan di port ${port} (prefix /api/v1)`,
    'Bootstrap',
  );
}
void bootstrap();
