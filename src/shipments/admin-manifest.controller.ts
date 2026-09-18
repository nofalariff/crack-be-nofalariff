import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminShipmentsService } from './admin-shipments.service';
import { ManifestQueryDto } from './dto/manifest-query.dto';

@ApiTags('admin-manifest')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/manifest')
export class AdminManifestController {
  constructor(private readonly adminShipments: AdminShipmentsService) {}

  @Get()
  @ApiOperation({
    summary: 'Manifest muatan, dikelompokkan per tujuan dan layanan',
  })
  manifest(@Query() query: ManifestQueryDto) {
    return this.adminShipments.manifest(query);
  }
}
