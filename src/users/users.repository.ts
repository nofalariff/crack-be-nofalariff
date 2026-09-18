import { Injectable } from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const withAgentProfile = {
  agentProfile: true,
} satisfies Prisma.UserInclude;

export type UserWithAgentProfile = Prisma.UserGetPayload<{
  include: typeof withAgentProfile;
}>;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(
    filters: { role?: UserRole; status?: UserStatus; search?: string },
    pagination: { page: number; limit: number },
  ) {
    const where: Prisma.UserWhereInput = {};
    if (filters.role) where.role = filters.role;
    if (filters.status) where.status = filters.status;

    if (filters.search) {
      const insensitive = {
        contains: filters.search,
        mode: 'insensitive' as const,
      };
      where.OR = [
        { fullName: insensitive },
        { email: insensitive },
        { agentProfile: { companyName: insensitive } },
      ];
    }

    return this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: {
          ...withAgentProfile,
          _count: { select: { shipments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
  }

  findById(id: string): Promise<UserWithAgentProfile | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: withAgentProfile,
    });
  }

  countShipments(userId: string): Promise<number> {
    return this.prisma.shipment.count({ where: { userId } });
  }

  countShipmentsByStatus(userId: string) {
    return this.prisma.shipment.groupBy({
      by: ['status'],
      where: { userId },
      _count: { _all: true },
    });
  }

  sumPaidAmount(userId: string) {
    return this.prisma.shipment.aggregate({
      where: { userId, paymentStatus: 'PAID' },
      _sum: { totalAmount: true },
    });
  }

  findRecentShipments(userId: string, take: number) {
    return this.prisma.shipment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async updateStatus(
    id: string,
    status: UserStatus,
    audit: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<UserWithAgentProfile> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { status },
        include: withAgentProfile,
      });

      await audit(tx);
      return updated;
    });
  }
}
