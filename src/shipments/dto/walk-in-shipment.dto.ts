import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { CreateShipmentDto } from './create-shipment.dto';

export class WalkInShipmentDto extends CreateShipmentDto {
  @ApiPropertyOptional({
    description: 'Kosongkan untuk kiriman walk-in atas nama admin',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  })
  @IsString()
  onBehalfOfUserId?: string;
}
