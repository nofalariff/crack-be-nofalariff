import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterAgentDto } from './dto/register-agent.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { AuthenticatedUser } from './types/authenticated-user';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Registrasi customer (B2C) — tanpa token' })
  register(@Body() dto: RegisterCustomerDto) {
    return this.authService.registerCustomer(dto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('register/agent')
  @ApiOperation({ summary: 'Registrasi agen (B2B) — tanpa token' })
  registerAgent(@Body() dto: RegisterAgentDto) {
    return this.authService.registerAgent(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login dan menerbitkan pasangan token' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Menerbitkan pasangan token baru (rotasi)' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mencabut refresh token sesi ini' })
  async logout(@CurrentUser() user: AuthenticatedUser, @Body() dto: LogoutDto) {
    await this.authService.logout(user.id, dto);
    return null;
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profil user yang sedang login' })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ubah profil user yang sedang login' })
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.id, dto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ganti password — mencabut seluruh sesi' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(user.id, dto);
    return null;
  }
}
