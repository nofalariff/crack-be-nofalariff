import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LogoutDto {
  @ApiProperty({ description: 'Refresh token milik sesi yang ingin diakhiri' })
  @IsString()
  @IsNotEmpty({ message: 'Refresh token wajib diisi' })
  refreshToken: string;
}
