import { Module } from '@nestjs/common';
import { RecipientsController } from './recipients.controller';
import { RecipientsRepository } from './recipients.repository';
import { RecipientsService } from './recipients.service';

@Module({
  controllers: [RecipientsController],
  providers: [RecipientsService, RecipientsRepository],
})
export class UsersModule {}
