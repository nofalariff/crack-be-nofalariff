import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AgentsService } from './agents.service';
import { ListAgentsQueryDto } from './dto/list-agents-query.dto';
import { RejectAgentDto } from './dto/reject-agent.dto';

@ApiTags('admin-agents')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar pengajuan agen — terlama lebih dulu' })
  list(@Query() query: ListAgentsQueryDto) {
    return this.agentsService.list(query);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Setujui pengajuan agen' })
  approve(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.agentsService.approve(admin.id, id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Tolak pengajuan agen — alasan minimal 10 karakter',
  })
  reject(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectAgentDto,
  ) {
    return this.agentsService.reject(admin.id, id, dto);
  }
}
