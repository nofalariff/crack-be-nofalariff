import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditController } from './audit.controller';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';

// Global: hampir setiap modul admin perlu mencatat jejak aksinya.
@Global()
@Module({
  imports: [AuthModule],
  controllers: [AuditController],
  providers: [AuditService, AuditRepository],
  exports: [AuditService],
})
export class AuditModule {}
