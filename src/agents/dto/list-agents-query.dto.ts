import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListAgentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ApprovalStatus })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  })
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;
}
