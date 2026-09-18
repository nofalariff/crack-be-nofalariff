import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { ShipmentsModule } from '../shipments/shipments.module';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ShipmentsModule, AgentsModule],
  controllers: [DashboardController, AdminDashboardController],
  providers: [DashboardService, AdminDashboardService],
})
export class DashboardModule {}
