import { Shipment, ShipmentStatus, User, UserRole } from '@prisma/client';
import {
  ShipmentDetailView,
  ShipmentSummaryView,
  ShipmentWithRelations,
  toShipmentDetail,
  toShipmentSummary,
} from './shipment.view';

export interface AdminShipmentSummaryView extends ShipmentSummaryView {
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerRole: UserRole;
  senderPhone: string;
  recipientPhone: string;
  totalColli: number;
  /** Hari sejak perubahan status terakhir — penanda kiriman mandek. */
  daysSinceUpdate: number;
}

export interface AdminShipmentDetailView extends ShipmentDetailView {
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerRole: UserRole;
  previousStatus: ShipmentStatus | null;
}

export interface BulkStatusResultView {
  updatedCount: number;
  skipped: Array<{ trackingNumber: string; reason: string }>;
}

export interface WeightCorrectionResultView {
  shipment: AdminShipmentDetailView;
  previousChargeableWeight: number;
  previousTotalAmount: number;
  difference: number;
}

export type ShipmentWithCustomer = Shipment & { user: User };

export function daysSince(value: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - value.getTime()) / 86_400_000);
}

export function toAdminShipmentSummary(
  shipment: ShipmentWithCustomer,
): AdminShipmentSummaryView {
  return {
    ...toShipmentSummary(shipment),
    customerId: shipment.userId,
    customerName: shipment.user.fullName,
    customerEmail: shipment.user.email,
    customerRole: shipment.user.role,
    senderPhone: shipment.senderPhone,
    recipientPhone: shipment.recipientPhone,
    totalColli: shipment.totalColli,
    daysSinceUpdate: daysSince(shipment.updatedAt),
  };
}

export function toAdminShipmentDetail(
  shipment: ShipmentWithRelations & { user: User },
): AdminShipmentDetailView {
  return {
    ...toShipmentDetail(shipment),
    customerId: shipment.userId,
    customerName: shipment.user.fullName,
    customerEmail: shipment.user.email,
    customerRole: shipment.user.role,
    previousStatus: shipment.previousStatus,
  };
}
