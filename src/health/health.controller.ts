import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Status aplikasi dan koneksi database' })
  async check(@Res({ passthrough: true }) res: Response) {
    const result = await this.healthService.check();
    // 503 saat database mati agar health check platform menandai layanan
    // tidak sehat, bukan hanya membaca status di body.
    if (result.database === 'down') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
