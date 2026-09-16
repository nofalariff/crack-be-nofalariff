import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ListRoutesQueryDto } from './dto/list-routes-query.dto';
import { RoutesService } from './routes.service';

@ApiTags('routes')
@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Daftar rute aktif beserta tarif berjalan' })
  list(@Query() query: ListRoutesQueryDto) {
    return this.routesService.listActive(query.serviceType);
  }
}
