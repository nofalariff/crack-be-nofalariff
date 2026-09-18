import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminUsersService } from './admin-users.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@ApiTags('admin-users')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar pengguna dengan penyaring' })
  list(@Query() query: ListUsersQueryDto) {
    return this.adminUsers.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail pengguna beserta ringkasan kirimannya' })
  detail(@Param('id') id: string) {
    return this.adminUsers.detail(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Aktifkan atau tangguhkan akun' })
  updateStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminUsers.updateStatus(admin.id, id, dto);
  }
}
