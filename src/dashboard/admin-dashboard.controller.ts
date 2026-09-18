import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminDashboardService } from './admin-dashboard.service';

@ApiTags('admin-dashboard')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly adminDashboard: AdminDashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Ringkasan operasional dan antrean tindakan' })
  summary() {
    return this.adminDashboard.summary();
  }
}
