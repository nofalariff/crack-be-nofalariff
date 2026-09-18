import { ServiceType, ShipmentStatus } from '@prisma/client';

// Data label dan manifest disajikan sebagai JSON, bukan PDF — pencetakan
// dikerjakan di sisi klien (planbackend.md §9.6/§9.8).

export interface ShipmentLabelView {
  trackingNumber: string;
  serviceType: ServiceType;
  destinationCode: string;
  destinationName: string;
  estimatedDays: number;
  status: ShipmentStatus;
  createdAt: Date;
  sender: { name: string; phone: string };
  recipient: {
    name: string;
    phone: string;
    address: string;
    city: string;
    postalCode: string | null;
  };
  totalColli: number;
  chargeableWeight: number;
  declaredWeight: number;
  actualWeight: number | null;
  totalAmount: number;
  paymentStatus: string;
  itemSummary: string;
  notes: string | null;
}

export interface ManifestLineView {
  trackingNumber: string;
  status: ShipmentStatus;
  senderName: string;
  recipientName: string;
  recipientCity: string;
  totalColli: number;
  chargeableWeight: number;
  totalAmount: number;
  createdAt: Date;
}

export interface ManifestGroupView {
  destinationCode: string;
  destinationName: string;
  serviceType: ServiceType;
  shipmentCount: number;
  totalColli: number;
  totalChargeableWeight: number;
  totalAmount: number;
  shipments: ManifestLineView[];
}

export interface ManifestView {
  generatedAt: Date;
  filters: {
    destinationCode: string | null;
    serviceType: ServiceType | null;
    status: ShipmentStatus[];
    dateFrom: string | null;
    dateTo: string | null;
  };
  totals: {
    shipmentCount: number;
    totalColli: number;
    totalChargeableWeight: number;
    totalAmount: number;
  };
  groups: ManifestGroupView[];
}
