import { Controller, Get, Param, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FilesService } from './files.service';

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Ambil berkas — hanya pemilik atau admin' })
  async serve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<StreamableFile> {
    const file = await this.filesService.serve(id, user);

    return new StreamableFile(file.stream, {
      type: file.mimeType,
      length: file.sizeBytes,
      disposition: `inline; filename="${encodeURIComponent(file.originalName)}"`,
    });
  }
}
