import { ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListRoutesQueryDto {
  @ApiPropertyOptional({ enum: ServiceType })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;
}
