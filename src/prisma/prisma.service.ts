import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Terhubung ke PostgreSQL');
    } catch (error) {
      // Aplikasi tetap start; /health akan melaporkan database sebagai "down"
      // dan Prisma akan mencoba lagi otomatis pada query berikutnya.
      this.logger.error(
        'Gagal terhubung ke PostgreSQL saat start',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
