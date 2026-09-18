import { Injectable } from '@nestjs/common';
import { ApprovalStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { Paginated } from '../common/dto/pagination-meta';
import { DomainException } from '../common/exceptions/domain.exception';
import { AdminUserView, toAdminUser } from '../users/admin-user.view';
import { UsersRepository } from '../users/users.repository';
import { AgentProfileWithUser, AgentsRepository } from './agents.repository';
import { ListAgentsQueryDto } from './dto/list-agents-query.dto';
import { RejectAgentDto } from './dto/reject-agent.dto';

const MIN_REJECTION_REASON_LENGTH = 10;

export interface AgentListItemView {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  companyAddress: string;
  picName: string;
  picPhone: string;
  npwp: string | null;
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
}

@Injectable()
export class AgentsService {
  constructor(
    private readonly repo: AgentsRepository,
    private readonly usersRepo: UsersRepository,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListAgentsQueryDto): Promise<Paginated<AgentListItemView>> {
    const [rows, total] = await this.repo.findMany(query.status, {
      page: query.page,
      limit: query.limit,
    });

    return {
      data: rows.map((row) => this.toListItem(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async approve(adminId: string, userId: string): Promise<AdminUserView> {
    const agent = await this.getOrThrow(userId);

    // Menyetujui agen yang sudah disetujui ditolak (§7.8).
    if (agent.approvalStatus === 'APPROVED') {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Agen ini sudah disetujui sebelumnya.',
        undefined,
        409,
      );
    }

    return this.review(adminId, agent, {
      approvalStatus: 'APPROVED',
      rejectionReason: null,
      action: 'AGENT_APPROVED',
      after: { approvalStatus: 'APPROVED' },
    });
  }

  // Penolakan mengizinkan agen memperbaiki data lalu mengajukan ulang (§7.8).
  async reject(
    adminId: string,
    userId: string,
    dto: RejectAgentDto,
  ): Promise<AdminUserView> {
    const agent = await this.getOrThrow(userId);
    const reason = dto.reason?.trim() ?? '';

    if (reason.length < MIN_REJECTION_REASON_LENGTH) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Alasan penolakan minimal 10 karakter.',
        [{ field: 'reason', message: 'Alasan penolakan minimal 10 karakter.' }],
      );
    }

    return this.review(adminId, agent, {
      approvalStatus: 'REJECTED',
      rejectionReason: reason,
      action: 'AGENT_REJECTED',
      after: { approvalStatus: 'REJECTED', reason },
    });
  }

  private async review(
    adminId: string,
    agent: AgentProfileWithUser,
    input: {
      approvalStatus: ApprovalStatus;
      rejectionReason: string | null;
      action: 'AGENT_APPROVED' | 'AGENT_REJECTED';
      after: Record<string, string>;
    },
  ): Promise<AdminUserView> {
    const updated = await this.repo.review(
      agent.userId,
      {
        approvalStatus: input.approvalStatus,
        rejectionReason: input.rejectionReason,
        reviewedBy: adminId,
      },
      (tx) =>
        this.audit.record(
          {
            action: input.action,
            actorId: adminId,
            entityType: 'agent',
            entityId: agent.userId,
            entityLabel: agent.companyName,
            before: { approvalStatus: agent.approvalStatus },
            after: input.after,
          },
          tx,
        ),
    );

    const shipmentCount = await this.usersRepo.countShipments(agent.userId);
    return toAdminUser(updated.user, updated, shipmentCount);
  }

  private async getOrThrow(userId: string): Promise<AgentProfileWithUser> {
    const agent = await this.repo.findByUserId(userId);
    if (!agent) {
      throw new DomainException('NOT_FOUND', 'Agen tidak ditemukan.');
    }
    return agent;
  }

  private toListItem(agent: AgentProfileWithUser): AgentListItemView {
    return {
      userId: agent.userId,
      fullName: agent.user.fullName,
      email: agent.user.email,
      phone: agent.user.phone,
      companyName: agent.companyName,
      companyAddress: agent.companyAddress,
      picName: agent.picName,
      picPhone: agent.picPhone,
      npwp: agent.npwp,
      approvalStatus: agent.approvalStatus,
      rejectionReason: agent.rejectionReason,
      submittedAt: agent.createdAt,
      reviewedAt: agent.reviewedAt,
    };
  }
}
