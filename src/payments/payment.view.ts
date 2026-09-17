import {
  Attachment,
  Payment,
  PaymentRecordStatus,
  ServiceType,
  ShipmentPaymentStatus,
} from '@prisma/client';

export type PaymentWithAttachment = Payment & { attachment: Attachment };

export interface PaymentView {
  id: string;
  claimedAmount: number;
  senderAccountName: string;
  transferDate: Date;
  attachmentId: string;
  attachmentName: string;
  status: PaymentRecordStatus;
  rejectionReason: string | null;
  createdAt: Date;
  verifiedAt: Date | null;
}

export interface BankAccountView {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export interface InvoiceView {
  trackingNumber: string;
  issuedAt: Date;
  dueAt: Date;
  customerName: string;
  customerEmail: string;
  serviceType: ServiceType;
  destinationName: string;
  chargeableWeight: number;
  pricePerKg: number;
  weightFee: number;
  baseFee: number;
  totalAmount: number;
  outstandingAmount: number;
  paymentStatus: ShipmentPaymentStatus;
  bankAccount: BankAccountView;
  payments: PaymentView[];
}

export interface PaymentQueueItemView {
  paymentId: string;
  shipmentId: string;
  trackingNumber: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  claimedAmount: number;
  /** claimedAmount - totalAmount; negatif berarti kurang bayar. */
  difference: number;
  senderAccountName: string;
  transferDate: Date;
  attachmentId: string;
  attachmentName: string;
  status: PaymentRecordStatus;
  submittedAt: Date;
}

export function toPaymentView(payment: PaymentWithAttachment): PaymentView {
  return {
    id: payment.id,
    claimedAmount: Number(payment.claimedAmount),
    senderAccountName: payment.senderAccountName,
    transferDate: payment.transferDate,
    attachmentId: payment.attachmentId,
    attachmentName: payment.attachment.originalName,
    status: payment.status,
    rejectionReason: payment.rejectionReason,
    createdAt: payment.createdAt,
    verifiedAt: payment.verifiedAt,
  };
}
