import { Injectable } from '@nestjs/common';
import { ShipmentStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { Paginated } from '../common/dto/pagination-meta';
import { DomainException } from '../common/exceptions/domain.exception';
import { toShipmentSummary } from '../shipments/shipment.view';
import {
  AdminUserDetailView,
  AdminUserView,
  toAdminUser,
  toAgentProfileView,
} from './admin-user.view';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersRepository } from './users.repository';

const RECENT_SHIPMENTS_LIMIT = 5;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListUsersQueryDto): Promise<Paginated<AdminUserView>> {
    const [rows, total] = await this.repo.findMany(
      { role: query.role, status: query.status, search: query.search },
      { page: query.page, limit: query.limit },
    );

    return {
      data: rows.map((row) =>
        toAdminUser(row, row.agentProfile, row._count.shipments),
      ),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async detail(id: string): Promise<AdminUserDetailView> {
    const user = await this.getOrThrow(id);

    const [grouped, paidSum, recent] = await Promise.all([
      this.repo.countShipmentsByStatus(id),
      this.repo.sumPaidAmount(id),
      this.repo.findRecentShipments(id, RECENT_SHIPMENTS_LIMIT),
    ]);

    const statusCounts: Partial<Record<ShipmentStatus, number>> = {};
    let shipmentCount = 0;
    for (const row of grouped) {
      statusCounts[row.status] = row._count._all;
      shipmentCount += row._count._all;
    }

    return {
      ...toAdminUser(user, user.agentProfile, shipmentCount),
      agentProfile: toAgentProfileView(user.agentProfile),
      statusCounts,
      totalSpent: Number(paidSum._sum.totalAmount ?? 0n),
      recentShipments: recent.map((row) => toShipmentSummary(row)),
    };
  }

  async updateStatus(
    adminId: string,
    id: string,
    dto: UpdateUserStatusDto,
  ): Promise<AdminUserView> {
    const user = await this.getOrThrow(id);

    // Admin tidak dapat mengubah status akunnya sendiri (§7.8).
    if (user.id === adminId) {
      throw new DomainException(
        'FORBIDDEN',
        'Anda tidak dapat mengubah status akun Anda sendiri.',
      );
    }

    const updated = await this.repo.updateStatus(id, dto.status, (tx) =>
      this.audit.record(
        {
          action: 'USER_STATUS_CHANGED',
          actorId: adminId,
          entityType: 'user',
          entityId: user.id,
          entityLabel: user.email,
          before: { status: user.status },
          after: { status: dto.status },
        },
        tx,
      ),
    );

    const shipmentCount = await this.repo.countShipments(id);
    return toAdminUser(updated, updated.agentProfile, shipmentCount);
  }

  private async getOrThrow(id: string) {
    const user = await this.repo.findById(id);
    if (!user) {
      throw new DomainException('NOT_FOUND', 'Pengguna tidak ditemukan.');
    }
    return user;
  }
}
