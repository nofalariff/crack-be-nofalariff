import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateRecipientDto } from './dto/create-recipient.dto';
import { UpdateRecipientDto } from './dto/update-recipient.dto';
import { RecipientsService } from './recipients.service';

@ApiTags('recipients')
@ApiBearerAuth()
@Controller('recipients')
export class RecipientsController {
  constructor(private readonly recipientsService: RecipientsService) {}

  @Get()
  @ApiOperation({ summary: 'Buku alamat milik sendiri' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.recipientsService.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Tambah penerima ke buku alamat' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRecipientDto,
  ) {
    return this.recipientsService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ubah data penerima di buku alamat' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRecipientDto,
  ) {
    return this.recipientsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Hapus penerima dari buku alamat' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.recipientsService.remove(user.id, id);
  }
}
