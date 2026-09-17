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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CancelShipmentDto } from './dto/cancel-shipment.dto';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ListShipmentsQueryDto } from './dto/list-shipments-query.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { ShipmentsService } from './shipments.service';

@ApiTags('shipments')
@ApiBearerAuth()
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar kiriman milik sendiri' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListShipmentsQueryDto,
  ) {
    return this.shipmentsService.list(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Buat booking kiriman baru' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateShipmentDto,
  ) {
    return this.shipmentsService.create(user.id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batalkan kiriman yang belum dibayar' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CancelShipmentDto,
  ) {
    return this.shipmentsService.cancel(user.id, id, dto);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Booking ulang memakai data kiriman lama' })
  duplicate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.shipmentsService.duplicate(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ubah data penerima dan catatan kiriman' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateShipmentDto,
  ) {
    return this.shipmentsService.update(user.id, id, dto);
  }

  // Terdaftar terakhir agar tidak menelan rute :id/... di atasnya.
  @Get(':trackingNumber')
  @ApiOperation({ summary: 'Detail kiriman berdasarkan nomor resi' })
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('trackingNumber') trackingNumber: string,
  ) {
    return this.shipmentsService.findByTrackingNumber(user.id, trackingNumber);
  }
}
