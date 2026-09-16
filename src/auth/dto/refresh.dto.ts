import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Refresh token wajib diisi' })
  refreshToken: string;
}
