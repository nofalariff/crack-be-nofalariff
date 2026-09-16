import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { agentProfile: true },
    });
  }

  findUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { agentProfile: true },
    });
  }

  createCustomer(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    phone: string;
  }) {
    return this.prisma.user.create({
      data: { ...data, role: 'CUSTOMER' },
      include: { agentProfile: true },
    });
  }

  createAgent(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    phone: string;
    companyName: string;
    companyAddress: string;
    picName: string;
    picPhone: string;
    npwp?: string;
  }) {
    const {
      companyName,
      companyAddress,
      picName,
      picPhone,
      npwp,
      ...userData
    } = data;
    return this.prisma.user.create({
      data: {
        ...userData,
        role: 'AGENT',
        agentProfile: {
          create: { companyName, companyAddress, picName, picPhone, npwp },
        },
      },
      include: { agentProfile: true },
    });
  }

  updateUser(userId: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      include: { agentProfile: true },
    });
  }

  updateAgentProfile(userId: string, data: Prisma.AgentProfileUpdateInput) {
    return this.prisma.agentProfile.update({
      where: { userId },
      data,
    });
  }

  updatePasswordHash(userId: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  createRefreshToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return this.prisma.refreshToken.create({ data });
  }

  findRefreshTokenByHash(tokenHash: string) {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { agentProfile: true } } },
    });
  }

  revokeRefreshToken(id: string) {
    return this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  revokeAllUserRefreshTokens(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
