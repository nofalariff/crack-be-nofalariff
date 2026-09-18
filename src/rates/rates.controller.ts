import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RATE_LIMITS } from '../common/utils/rate-limit';
import { Public } from '../common/decorators/public.decorator';
import { CalculateRateDto } from './dto/calculate-rate.dto';
import { RatesService } from './rates.service';

@ApiTags('rates')
@Controller('rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Public()
  @Throttle({ default: RATE_LIMITS.rateCalculator })
  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hitung ongkir untuk rute dan berat tertentu' })
  calculate(@Body() dto: CalculateRateDto) {
    return this.ratesService.calculate(dto);
  }
}
