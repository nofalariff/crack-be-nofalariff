import { Injectable } from '@nestjs/common';
import { Prisma, PaymentRecordStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const queueInclude = {
  attachment: true,
  shipment: { include: { user: true } },
} satisfies Prisma.PaymentInclude;

export type PaymentForQueue = Prisma.PaymentGetPayload<{
  include: typeof queueInclude;
}>;

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<PaymentForQueue | null> {
    return this.prisma.payment.findUnique({
      where: { id },
      include: queueInclude,
    });
  }

  countVerifiedForShipment(
    shipmentId: string,
    excludePaymentId: string,
  ): Promise<number> {
    return this.prisma.payment.count({
      where: {
        shipmentId,
        status: 'VERIFIED',
        id: { not: excludePaymentId },
      },
    });
  }

  // Antrean kerja: terlama lebih dulu (FR-PAY-03).
  findQueue(
    status: PaymentRecordStatus | undefined,
    pagination: { page: number; limit: number },
  ) {
    const where: Prisma.PaymentWhereInput = status ? { status } : {};

    return this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: queueInclude,
        orderBy: { createdAt: 'asc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
  }

  // Unggah bukti menyentuh attachments + payments + shipments — satu transaksi.
  async createWithAttachment(data: {
    shipmentId: string;
    claimedAmount: bigint;
    senderAccountName: string;
    transferDate: Date;
    attachment: {
      storageKey: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      uploadedById: string;
    };
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const attachment = await tx.attachment.create({
        data: data.attachment,
      });

      await tx.payment.create({
        data: {
          shipmentId: data.shipmentId,
          attachmentId: attachment.id,
          claimedAmount: data.claimedAmount,
          senderAccountName: data.senderAccountName,
          transferDate: data.transferDate,
        },
      });

      await tx.shipment.update({
        where: { id: data.shipmentId },
        data: { paymentStatus: 'WAITING_VERIFICATION' },
      });
    });
  }

  // Persetujuan menyentuh payments + shipments + shipment_events + audit_logs
  // (§4.3).
  async verify(
    data: {
      paymentId: string;
      shipmentId: string;
      appendPaidEvent: boolean;
    },
    audit: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: data.paymentId },
        data: {
          status: 'VERIFIED',
          verifiedAt: new Date(),
          rejectionReason: null,
        },
      });

      await tx.shipment.update({
        where: { id: data.shipmentId },
        data: {
          paymentStatus: 'PAID',
          outstandingAmount: 0,
          ...(data.appendPaidEvent
            ? {
                status: 'PAID',
                events: {
                  create: {
                    status: 'PAID',
                    notes: 'Pembayaran terverifikasi',
                  },
                },
              }
            : {}),
        },
      });

      await audit(tx);
    });
  }

  // Penolakan mengembalikan kiriman ke UNPAID agar customer bisa unggah ulang.
  async reject(
    data: {
      paymentId: string;
      shipmentId: string;
      reason: string;
    },
    audit: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: data.paymentId },
        data: { status: 'REJECTED', rejectionReason: data.reason },
      });

      await tx.shipment.update({
        where: { id: data.shipmentId },
        data: { paymentStatus: 'UNPAID' },
      });

      await audit(tx);
    });
  }

  findAttachmentById(id: string) {
    return this.prisma.attachment.findUnique({
      where: { id },
      include: { payment: { include: { shipment: true } } },
    });
  }
}
