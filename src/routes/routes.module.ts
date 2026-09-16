import { Module } from '@nestjs/common';
import { AdminRoutesController } from './admin-routes.controller';
import { RoutesController } from './routes.controller';
import { RoutesRepository } from './routes.repository';
import { RoutesService } from './routes.service';

@Module({
  controllers: [RoutesController, AdminRoutesController],
  providers: [RoutesService, RoutesRepository],
  exports: [RoutesRepository],
})
export class RoutesModule {}
