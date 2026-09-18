import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { RecipientsController } from './recipients.controller';
import { RecipientsRepository } from './recipients.repository';
import { RecipientsService } from './recipients.service';
import { UsersRepository } from './users.repository';

@Module({
  controllers: [RecipientsController, AdminUsersController],
  providers: [
    RecipientsService,
    RecipientsRepository,
    AdminUsersService,
    UsersRepository,
  ],
  exports: [UsersRepository],
})
export class UsersModule {}
