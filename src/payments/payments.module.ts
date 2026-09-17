import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '../auth/auth.module';
import { ShipmentsModule } from '../shipments/shipments.module';
import { AdminPaymentsController } from './admin-payments.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    AuthModule,
    ShipmentsModule,
    // Berkas ditahan di memori agar isinya bisa diperiksa lewat magic number
    // sebelum menyentuh penyimpanan. Batas ukuran dipasang di sini supaya
    // unggahan raksasa berhenti sebelum membebani memori.
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        limits: {
          fileSize:
            config.getOrThrow<number>('MAX_UPLOAD_SIZE_MB') * 1024 * 1024,
          files: 1,
        },
      }),
    }),
  ],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService, PaymentsRepository],
  exports: [PaymentsRepository],
})
export class PaymentsModule {}
