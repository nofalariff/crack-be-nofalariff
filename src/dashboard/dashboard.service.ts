import { Injectable } from '@nestjs/common';
import { ShipmentStatus } from '@prisma/client';
import {
  ShipmentSummaryView,
  toShipmentSummary,
} from '../shipments/shipment.view';
import { ShipmentsRepository } from '../shipments/shipments.repository';

const RECENT_LIMIT = 5;
const NOT_IN_PROGRESS: ShipmentStatus[] = [
  'PENDING_PAYMENT',
  'DELIVERED',
  'CANCELLED',
];

export interface DashboardSummaryView {
  statusCounts: Partial<Record<ShipmentStatus, number>>;
  totalShipments: number;
  awaitingPaymentCount: number;
  inProgressCount: number;
  deliveredCount: number;
  recentShipments: ShipmentSummaryView[];
}

@Injectable()
export class DashboardService {
  constructor(private readonly shipmentsRepo: ShipmentsRepository) {}

  async summaryFor(userId: string): Promise<DashboardSummaryView> {
    const [grouped, recent] = await Promise.all([
      this.shipmentsRepo.countByStatusForUser(userId),
      this.shipmentsRepo.findRecentByUser(userId, RECENT_LIMIT),
    ]);

    const statusCounts: Partial<Record<ShipmentStatus, number>> = {};
    for (const row of grouped) {
      statusCounts[row.status] = row._count._all;
    }

    const countOf = (status: ShipmentStatus) => statusCounts[status] ?? 0;
    const totalShipments = grouped.reduce(
      (sum, row) => sum + row._count._all,
      0,
    );
    // ON_HOLD ikut dihitung sebagai sedang berjalan — mengikuti perilaku
    // handler mock, bukan konstanta IN_PROGRESS_STATUSES di frontend.
    const inProgressCount = grouped
      .filter((row) => !NOT_IN_PROGRESS.includes(row.status))
      .reduce((sum, row) => sum + row._count._all, 0);

    return {
      statusCounts,
      totalShipments,
      awaitingPaymentCount: countOf('PENDING_PAYMENT'),
      inProgressCount,
      deliveredCount: countOf('DELIVERED'),
      recentShipments: recent.map((row) => toShipmentSummary(row)),
    };
  }
}
