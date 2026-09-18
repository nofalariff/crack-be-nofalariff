import { Injectable } from '@nestjs/common';
import { ShipmentStatus } from '@prisma/client';
import { AgentsRepository } from '../agents/agents.repository';
import {
  AdminShipmentSummaryView,
  toAdminShipmentSummary,
} from '../shipments/admin-shipment.view';
import { ShipmentsRepository } from '../shipments/shipments.repository';

// Kiriman aktif dianggap mandek bila tidak bergerak lebih dari 3 hari (§6.5).
// Dihitung dalam hari penuh, sama seperti `daysSinceUpdate` yang tampil di
// daftar admin: "lebih dari 3 hari" berarti sudah genap 4 hari atau lebih.
const STALL_THRESHOLD_DAYS = 3;
const NEEDS_ATTENTION_LIMIT = 8;

export interface AdminDashboardSummaryView {
  pendingPaymentVerification: number;
  pendingAgentApproval: number;
  stalledShipments: number;
  totalShipments: number;
  activeShipments: number;
  statusCounts: Partial<Record<ShipmentStatus, number>>;
  needsAttention: AdminShipmentSummaryView[];
}

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly shipmentsRepo: ShipmentsRepository,
    private readonly agentsRepo: AgentsRepository,
  ) {}

  async summary(): Promise<AdminDashboardSummaryView> {
    const stalledBefore = new Date(
      Date.now() - (STALL_THRESHOLD_DAYS + 1) * 86_400_000,
    );

    const [
      pendingPaymentVerification,
      pendingAgentApproval,
      stalledShipments,
      totalShipments,
      activeShipments,
      grouped,
      needsAttention,
    ] = await Promise.all([
      this.shipmentsRepo.countPendingPaymentVerification(),
      this.agentsRepo.countByApprovalStatus('PENDING'),
      this.shipmentsRepo.countStalled(stalledBefore),
      this.shipmentsRepo.countAll(),
      this.shipmentsRepo.countActive(),
      this.shipmentsRepo.countByStatus(),
      this.shipmentsRepo.findStalled(stalledBefore, NEEDS_ATTENTION_LIMIT),
    ]);

    const statusCounts: Partial<Record<ShipmentStatus, number>> = {};
    for (const row of grouped) {
      statusCounts[row.status] = row._count._all;
    }

    return {
      pendingPaymentVerification,
      pendingAgentApproval,
      stalledShipments,
      totalShipments,
      activeShipments,
      statusCounts,
      needsAttention: needsAttention.map((row) => toAdminShipmentSummary(row)),
    };
  }
}
