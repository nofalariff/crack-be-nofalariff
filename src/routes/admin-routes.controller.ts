import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateRouteDto } from './dto/create-route.dto';
import { SetRateDto } from './dto/set-rate.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { RoutesService } from './routes.service';

@ApiTags('admin-routes')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/routes')
export class AdminRoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar seluruh rute (aktif & nonaktif)' })
  list() {
    return this.routesService.listForAdmin();
  }

  @Post()
  @ApiOperation({ summary: 'Buat rute baru — tanpa tarif' })
  create(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateRouteDto) {
    return this.routesService.create(admin.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ubah data rute' })
  update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRouteDto,
  ) {
    return this.routesService.update(admin.id, id, dto);
  }

  @Put(':id/rate')
  @ApiOperation({ summary: 'Tetapkan tarif baru untuk rute' })
  setRate(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetRateDto,
  ) {
    return this.routesService.setRate(admin.id, id, dto);
  }
}
