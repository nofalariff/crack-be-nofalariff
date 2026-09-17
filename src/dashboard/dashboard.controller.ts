import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Roles('CUSTOMER', 'AGENT')
  @Get('summary')
  @ApiOperation({ summary: 'Ringkasan kiriman milik sendiri' })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.summaryFor(user.id);
  }
}
