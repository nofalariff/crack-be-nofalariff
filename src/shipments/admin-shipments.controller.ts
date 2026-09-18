import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminShipmentsService } from './admin-shipments.service';
import { AdminListShipmentsQueryDto } from './dto/admin-list-shipments-query.dto';
import { BulkStatusDto } from './dto/bulk-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { WalkInShipmentDto } from './dto/walk-in-shipment.dto';
import { WeightCorrectionDto } from './dto/weight-correction.dto';

@ApiTags('admin-shipments')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/shipments')
export class AdminShipmentsController {
  constructor(private readonly adminShipments: AdminShipmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar seluruh kiriman dengan penyaring' })
  list(@Query() query: AdminListShipmentsQueryDto) {
    return this.adminShipments.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Booking walk-in oleh admin' })
  createWalkIn(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: WalkInShipmentDto,
  ) {
    return this.adminShipments.createWalkIn(admin.id, dto);
  }

  @Get(':id/label')
  @ApiOperation({ summary: 'Data label kiriman untuk dicetak' })
  label(@Param('id') id: string) {
    return this.adminShipments.label(id);
  }

  // Terdaftar sebelum :id agar tidak tertelan rute detail.
  @Post('bulk-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ubah status massal — yang gagal dilewati' })
  bulkStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: BulkStatusDto,
  ) {
    return this.adminShipments.bulkChangeStatus(admin.id, dto);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ubah status satu kiriman' })
  changeStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.adminShipments.changeStatus(admin.id, id, dto);
  }

  @Patch(':id/weight')
  @ApiOperation({ summary: 'Koreksi berat timbang ulang' })
  correctWeight(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: WeightCorrectionDto,
  ) {
    return this.adminShipments.correctWeight(admin.id, id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail kiriman — menerima id atau nomor resi' })
  detail(@Param('id') id: string) {
    return this.adminShipments.detail(id);
  }
}
