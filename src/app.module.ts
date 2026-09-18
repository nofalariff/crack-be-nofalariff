import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { RoutesModule } from './routes/routes.module';
import { RatesModule } from './rates/rates.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { UsersModule } from './users/users.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { StorageModule } from './storage/storage.module';
import { PaymentsModule } from './payments/payments.module';
import { FilesModule } from './files/files.module';
import { AuditModule } from './audit/audit.module';
import { AgentsModule } from './agents/agents.module';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRoot([
      {
        // Batas umum — planbackend.md §8.3; endpoint sensitif (login, register,
        // kalkulator ongkir) menimpa ini dengan @Throttle() per modul.
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    RoutesModule,
    RatesModule,
    StorageModule,
    AuditModule,
    ShipmentsModule,
    UsersModule,
    AgentsModule,
    DashboardModule,
    PaymentsModule,
    FilesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
