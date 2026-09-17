import {
  ServiceType,
  Shipment,
  ShipmentEvent,
  ShipmentItem,
  ShipmentPaymentStatus,
  ShipmentStatus,
} from '@prisma/client';

// Bentuk response mengikuti `src/types/api.ts` di repo frontend (§1.2).
// `userId` dan `previousStatus` sengaja tidak ikut: keduanya milik internal
// dan tidak ada pada tipe publik `Shipment`.

export interface ShipmentSummaryView {
  id: string;
  trackingNumber: string;
  serviceType: ServiceType;
  destinationCode: string;
  destinationName: string;
  status: ShipmentStatus;
  paymentStatus: ShipmentPaymentStatus;
  recipientName: string;
  recipientCity: string;
  chargeableWeight: number;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShipmentItemView {
  id: string;
  description: string;
  quantity: number;
  weight: number;
  declaredValue: number | null;
}

export interface ShipmentEventView {
  id: string;
  status: ShipmentStatus;
  location: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface ShipmentDetailView extends ShipmentSummaryView {
  senderName: string;
  senderPhone: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientPostalCode: string | null;
  declaredWeight: number;
  actualWeight: number | null;
  totalColli: number;
  pricePerKgSnapshot: number;
  baseFeeSnapshot: number;
  outstandingAmount: number;
  notes: string | null;
  cancelReason: string | null;
  deliveredTo: string | null;
  estimatedDays: number;
  items: ShipmentItemView[];
  events: ShipmentEventView[];
  payments: unknown[];
}

export type ShipmentWithRelations = Shipment & {
  items: ShipmentItem[];
  events: ShipmentEvent[];
};

export function toShipmentSummary(shipment: Shipment): ShipmentSummaryView {
  return {
    id: shipment.id,
    trackingNumber: shipment.trackingNumber,
    serviceType: shipment.serviceType,
    destinationCode: shipment.destinationCode,
    destinationName: shipment.destinationName,
    status: shipment.status,
    paymentStatus: shipment.paymentStatus,
    recipientName: shipment.recipientName,
    recipientCity: shipment.recipientCity,
    chargeableWeight: shipment.chargeableWeight,
    totalAmount: Number(shipment.totalAmount),
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt,
  };
}

export function toShipmentDetail(
  shipment: ShipmentWithRelations,
): ShipmentDetailView {
  return {
    ...toShipmentSummary(shipment),
    senderName: shipment.senderName,
    senderPhone: shipment.senderPhone,
    recipientPhone: shipment.recipientPhone,
    recipientAddress: shipment.recipientAddress,
    recipientPostalCode: shipment.recipientPostalCode,
    declaredWeight: shipment.declaredWeight,
    actualWeight: shipment.actualWeight,
    totalColli: shipment.totalColli,
    pricePerKgSnapshot: Number(shipment.pricePerKgSnapshot),
    baseFeeSnapshot: Number(shipment.baseFeeSnapshot),
    outstandingAmount: Number(shipment.outstandingAmount),
    notes: shipment.notes,
    cancelReason: shipment.cancelReason,
    deliveredTo: shipment.deliveredTo,
    estimatedDays: shipment.estimatedDays,
    items: shipment.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      weight: item.weight,
      declaredValue:
        item.declaredValue === null ? null : Number(item.declaredValue),
    })),
    events: shipment.events.map((event) => ({
      id: event.id,
      status: event.status,
      location: event.location,
      notes: event.notes,
      createdAt: event.createdAt,
    })),
    // Diisi mulai milestone B5 saat model payments dibuat.
    payments: [],
  };
}
