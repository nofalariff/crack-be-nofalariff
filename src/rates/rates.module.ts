import { Module } from '@nestjs/common';
import { RoutesModule } from '../routes/routes.module';
import { RatesController } from './rates.controller';
import { RatesService } from './rates.service';

@Module({
  imports: [RoutesModule],
  controllers: [RatesController],
  providers: [RatesService],
})
export class RatesModule {}
