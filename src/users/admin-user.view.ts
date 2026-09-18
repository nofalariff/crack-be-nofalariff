import {
  AgentProfile,
  ApprovalStatus,
  ShipmentStatus,
  User,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { ShipmentSummaryView } from '../shipments/shipment.view';

export interface AdminUserView {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  companyName: string | null;
  approvalStatus: ApprovalStatus | null;
  shipmentCount: number;
}

export interface AgentProfileView {
  companyName: string;
  companyAddress: string;
  picName: string;
  picPhone: string;
  npwp: string | null;
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  reviewedAt: Date | null;
}

export interface AdminUserDetailView extends AdminUserView {
  agentProfile: AgentProfileView | null;
  statusCounts: Partial<Record<ShipmentStatus, number>>;
  totalSpent: number;
  recentShipments: ShipmentSummaryView[];
}

// passwordHash tidak pernah ikut keluar — hanya field di bawah ini yang
// dipetakan (§8.1).
export function toAdminUser(
  user: User,
  agentProfile: AgentProfile | null,
  shipmentCount: number,
): AdminUserView {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    companyName: agentProfile?.companyName ?? null,
    approvalStatus: agentProfile?.approvalStatus ?? null,
    shipmentCount,
  };
}

export function toAgentProfileView(
  agentProfile: AgentProfile | null,
): AgentProfileView | null {
  if (!agentProfile) return null;

  return {
    companyName: agentProfile.companyName,
    companyAddress: agentProfile.companyAddress,
    picName: agentProfile.picName,
    picPhone: agentProfile.picPhone,
    npwp: agentProfile.npwp,
    approvalStatus: agentProfile.approvalStatus,
    rejectionReason: agentProfile.rejectionReason,
    reviewedAt: agentProfile.reviewedAt,
  };
}
