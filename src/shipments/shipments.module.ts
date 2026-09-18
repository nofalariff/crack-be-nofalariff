import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoutesModule } from '../routes/routes.module';
import { AdminManifestController } from './admin-manifest.controller';
import { AdminShipmentsController } from './admin-shipments.controller';
import { AdminShipmentsService } from './admin-shipments.service';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsRepository } from './shipments.repository';
import { ShipmentsService } from './shipments.service';

@Module({
  imports: [AuthModule, RoutesModule],
  controllers: [
    ShipmentsController,
    AdminShipmentsController,
    AdminManifestController,
  ],
  providers: [ShipmentsService, AdminShipmentsService, ShipmentsRepository],
  exports: [ShipmentsRepository],
})
export class ShipmentsModule {}
