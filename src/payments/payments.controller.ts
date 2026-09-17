import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UploadPaymentDto } from './dto/upload-payment.dto';
import { PaymentsService } from './payments.service';
import type { UploadedProof } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('shipments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get(':trackingNumber/invoice')
  @ApiOperation({ summary: 'Tagihan kiriman beserta instruksi transfer' })
  invoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('trackingNumber') trackingNumber: string,
  ) {
    return this.paymentsService.invoiceFor(user.id, trackingNumber);
  }

  @Post(':id/payments')
  @UseInterceptors(FileInterceptor('proof'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['proof', 'claimedAmount', 'senderAccountName', 'transferDate'],
      properties: {
        proof: { type: 'string', format: 'binary' },
        claimedAmount: { type: 'number' },
        senderAccountName: { type: 'string' },
        transferDate: { type: 'string', format: 'date' },
      },
    },
  })
  @ApiOperation({ summary: 'Unggah bukti transfer' })
  uploadProof(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UploadPaymentDto,
    @UploadedFile() proof?: UploadedProof,
  ) {
    return this.paymentsService.uploadProof(user.id, id, dto, proof);
  }
}
