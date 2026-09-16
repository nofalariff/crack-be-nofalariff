import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AgentProfile, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';
import { DomainException } from '../common/exceptions/domain.exception';
import { AuthRepository } from './auth.repository';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterAgentDto } from './dto/register-agent.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const BCRYPT_COST = 12;

type UserWithAgentProfile = User & { agentProfile: AgentProfile | null };

export interface CurrentUserView {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: User['role'];
  status: User['status'];
  createdAt: Date;
  agentProfile: {
    companyName: string;
    companyAddress: string;
    picName: string;
    picPhone: string;
    npwp: string | null;
    approvalStatus: AgentProfile['approvalStatus'];
    rejectionReason: string | null;
    reviewedAt: Date | null;
  } | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async registerCustomer(dto: RegisterCustomerDto): Promise<CurrentUserView> {
    await this.ensureEmailAvailable(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const user = await this.repo.createCustomer({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      phone: dto.phone,
    });
    return this.toCurrentUser(user);
  }

  async registerAgent(dto: RegisterAgentDto): Promise<CurrentUserView> {
    await this.ensureEmailAvailable(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const user = await this.repo.createAgent({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      phone: dto.phone,
      companyName: dto.companyName,
      companyAddress: dto.companyAddress,
      picName: dto.picName,
      picPhone: dto.picPhone,
      npwp: dto.npwp,
    });
    return this.toCurrentUser(user);
  }

  async login(dto: LoginDto): Promise<AuthTokens & { user: CurrentUserView }> {
    const user = await this.repo.findUserByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new DomainException(
        'AUTH_INVALID_CREDENTIALS',
        'Email atau password salah.',
      );
    }
    if (user.status === 'SUSPENDED') {
      throw new DomainException(
        'AUTH_ACCOUNT_SUSPENDED',
        'Akun Anda sedang ditangguhkan.',
      );
    }

    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.toCurrentUser(user) };
  }

  async refresh(dto: RefreshDto): Promise<AuthTokens> {
    const payload = this.verifyRefreshToken(dto.refreshToken);
    const record = await this.repo.findRefreshTokenByHash(
      this.hashToken(dto.refreshToken),
    );

    if (!record || record.revokedAt || record.userId !== payload.sub) {
      throw new DomainException('UNAUTHORIZED');
    }
    if (record.user.status === 'SUSPENDED') {
      await this.repo.revokeRefreshToken(record.id);
      throw new DomainException(
        'AUTH_ACCOUNT_SUSPENDED',
        'Akun Anda sedang ditangguhkan.',
      );
    }

    await this.repo.revokeRefreshToken(record.id);
    return this.issueTokens(record.user);
  }

  async logout(userId: string, dto: LogoutDto): Promise<void> {
    const record = await this.repo.findRefreshTokenByHash(
      this.hashToken(dto.refreshToken),
    );
    if (record && record.userId === userId && !record.revokedAt) {
      await this.repo.revokeRefreshToken(record.id);
    }
  }

  async getMe(userId: string): Promise<CurrentUserView> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new DomainException('NOT_FOUND');
    return this.toCurrentUser(user);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<CurrentUserView> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new DomainException('NOT_FOUND');

    const userUpdate: { fullName?: string; phone?: string } = {};
    if (dto.fullName !== undefined) userUpdate.fullName = dto.fullName;
    if (dto.phone !== undefined) userUpdate.phone = dto.phone;
    if (Object.keys(userUpdate).length > 0) {
      await this.repo.updateUser(userId, userUpdate);
    }

    if (user.agentProfile) {
      const agentUpdate: Record<string, string | null> = {};
      if (dto.companyName !== undefined)
        agentUpdate.companyName = dto.companyName;
      if (dto.companyAddress !== undefined)
        agentUpdate.companyAddress = dto.companyAddress;
      if (dto.picName !== undefined) agentUpdate.picName = dto.picName;
      if (dto.picPhone !== undefined) agentUpdate.picPhone = dto.picPhone;
      if (dto.npwp !== undefined)
        agentUpdate.npwp = dto.npwp === '' ? null : dto.npwp;

      if (Object.keys(agentUpdate).length > 0) {
        await this.repo.updateAgentProfile(userId, agentUpdate);
      }
    }

    const updated = await this.repo.findUserById(userId);
    return this.toCurrentUser(updated!);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new DomainException('NOT_FOUND');

    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Password lama tidak sesuai.',
        [{ field: 'currentPassword', message: 'Password lama tidak sesuai.' }],
      );
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Password baru harus berbeda dari password lama.',
        [
          {
            field: 'newPassword',
            message: 'Password baru harus berbeda dari password lama.',
          },
        ],
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_COST);
    await this.repo.updatePasswordHash(userId, passwordHash);
    await this.repo.revokeAllUserRefreshTokens(userId);
  }

  private async ensureEmailAvailable(email: string): Promise<void> {
    const existing = await this.repo.findUserByEmail(email);
    if (existing) {
      throw new DomainException('VALIDATION_ERROR', 'Email sudah terdaftar.', [
        { field: 'email', message: 'Email sudah terdaftar.' },
      ]);
    }
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const accessToken = this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.getOrThrow<string>(
          'JWT_ACCESS_EXPIRES_IN',
        ) as StringValue,
      },
    );
    const { exp, iat } = this.jwt.decode<{ exp: number; iat: number }>(
      accessToken,
    );

    const refreshToken = this.jwt.sign(
      { sub: user.id, jti: randomUUID() },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.getOrThrow<string>(
          'JWT_REFRESH_EXPIRES_IN',
        ) as StringValue,
      },
    );
    const refreshDecoded = this.jwt.decode<{ exp: number }>(refreshToken);

    await this.repo.createRefreshToken({
      userId: user.id,
      tokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(refreshDecoded.exp * 1000),
    });

    return { accessToken, refreshToken, expiresIn: exp - iat };
  }

  private verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      return this.jwt.verify<RefreshTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new DomainException('UNAUTHORIZED');
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toCurrentUser(user: UserWithAgentProfile): CurrentUserView {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      agentProfile: user.agentProfile
        ? {
            companyName: user.agentProfile.companyName,
            companyAddress: user.agentProfile.companyAddress,
            picName: user.agentProfile.picName,
            picPhone: user.agentProfile.picPhone,
            npwp: user.agentProfile.npwp,
            approvalStatus: user.agentProfile.approvalStatus,
            rejectionReason: user.agentProfile.rejectionReason,
            reviewedAt: user.agentProfile.reviewedAt,
          }
        : null,
    };
  }
}
