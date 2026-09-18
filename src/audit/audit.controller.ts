import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

@ApiTags('admin-audit')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Riwayat aksi admin — terbaru lebih dulu' })
  list(@Query() query: ListAuditLogsQueryDto) {
    return this.auditService.list(query);
  }
}
