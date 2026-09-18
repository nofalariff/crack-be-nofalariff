import { Injectable } from '@nestjs/common';
import { ApprovalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const withUser = { user: true } satisfies Prisma.AgentProfileInclude;

export type AgentProfileWithUser = Prisma.AgentProfileGetPayload<{
  include: typeof withUser;
}>;

@Injectable()
export class AgentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Pengajuan terlama ditinjau lebih dulu (FR-AGENT-01).
  findMany(
    approvalStatus: ApprovalStatus | undefined,
    pagination: { page: number; limit: number },
  ) {
    const where: Prisma.AgentProfileWhereInput = approvalStatus
      ? { approvalStatus }
      : {};

    return this.prisma.$transaction([
      this.prisma.agentProfile.findMany({
        where,
        include: withUser,
        orderBy: { createdAt: 'asc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.agentProfile.count({ where }),
    ]);
  }

  findByUserId(userId: string): Promise<AgentProfileWithUser | null> {
    return this.prisma.agentProfile.findUnique({
      where: { userId },
      include: withUser,
    });
  }

  countByApprovalStatus(approvalStatus: ApprovalStatus): Promise<number> {
    return this.prisma.agentProfile.count({ where: { approvalStatus } });
  }

  async review(
    userId: string,
    data: {
      approvalStatus: ApprovalStatus;
      rejectionReason: string | null;
      reviewedBy: string;
    },
    audit: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<AgentProfileWithUser> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.agentProfile.update({
        where: { userId },
        data: { ...data, reviewedAt: new Date() },
        include: withUser,
      });

      await audit(tx);
      return updated;
    });
  }
}
