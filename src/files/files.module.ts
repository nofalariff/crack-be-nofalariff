import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [PaymentsModule],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
