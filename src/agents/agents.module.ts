import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AgentsController } from './agents.controller';
import { AgentsRepository } from './agents.repository';
import { AgentsService } from './agents.service';

@Module({
  imports: [UsersModule],
  controllers: [AgentsController],
  providers: [AgentsService, AgentsRepository],
  exports: [AgentsRepository],
})
export class AgentsModule {}
