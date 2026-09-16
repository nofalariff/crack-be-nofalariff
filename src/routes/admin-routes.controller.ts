import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  create(@Body() dto: CreateRouteDto) {
    return this.routesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ubah data rute' })
  update(@Param('id') id: string, @Body() dto: UpdateRouteDto) {
    return this.routesService.update(id, dto);
  }

  @Put(':id/rate')
  @ApiOperation({ summary: 'Tetapkan tarif baru untuk rute' })
  setRate(@Param('id') id: string, @Body() dto: SetRateDto) {
    return this.routesService.setRate(id, dto);
  }
}
