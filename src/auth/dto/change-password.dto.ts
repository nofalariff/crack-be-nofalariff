import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Password lama wajib diisi' })
  currentPassword: string;

  @ApiProperty()
  @MinLength(8, { message: 'Password minimal 8 karakter' })
  @Matches(/[a-zA-Z]/, {
    message: 'Password harus mengandung minimal satu huruf',
  })
  @Matches(/[0-9]/, { message: 'Password harus mengandung minimal satu angka' })
  newPassword: string;
}
