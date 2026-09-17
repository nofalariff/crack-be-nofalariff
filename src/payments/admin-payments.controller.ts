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
import { Roles } from '../common/decorators/roles.decorator';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { RejectPaymentDto } from './dto/reject-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('admin-payments')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'Antrean verifikasi pembayaran — terlama dulu' })
  queue(@Query() query: ListPaymentsQueryDto) {
    return this.paymentsService.queue(query);
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Setujui pembayaran' })
  verify(@Param('id') id: string) {
    return this.paymentsService.verify(id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tolak pembayaran — alasan minimal 10 karakter' })
  reject(@Param('id') id: string, @Body() dto: RejectPaymentDto) {
    return this.paymentsService.reject(id, dto);
  }
}
