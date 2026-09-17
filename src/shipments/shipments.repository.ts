import { Injectable } from '@nestjs/common';
import { Prisma, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ShipmentWithRelations } from './shipment.view';

const withRelations = {
  items: { orderBy: { createdAt: 'asc' } },
  // Riwayat dan pembayaran ditampilkan terbaru lebih dulu.
  events: { orderBy: { createdAt: 'desc' } },
  payments: { orderBy: { createdAt: 'desc' }, include: { attachment: true } },
} satisfies Prisma.ShipmentInclude;

export interface CreateShipmentData {
  userId: string;
  routeId: string;
  trackingNumber: string;
  serviceType: Prisma.ShipmentCreateInput['serviceType'];
  destinationCode: string;
  destinationName: string;
  estimatedDays: number;
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientCity: string;
  recipientPostalCode: string | null;
  declaredWeight: number;
  chargeableWeight: number;
  totalColli: number;
  pricePerKgSnapshot: bigint;
  baseFeeSnapshot: bigint;
  totalAmount: bigint;
  notes: string | null;
  prohibitedItemsAgreedAt: Date;
  item: {
    description: string;
    quantity: number;
    weight: number;
    declaredValue: bigint | null;
  };
  saveRecipient: boolean;
}

@Injectable()
export class ShipmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyByUser(
    userId: string,
    filters: {
      status?: ShipmentStatus;
      serviceType?: Prisma.ShipmentWhereInput['serviceType'];
      search?: string;
      trackingNumber?: string;
      dateFrom?: Date;
      dateTo?: Date;
    },
    pagination: { page: number; limit: number },
  ) {
    const where = this.buildWhere(userId, filters);

    return this.prisma.$transaction([
      this.prisma.shipment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.shipment.count({ where }),
    ]);
  }

  findByTrackingNumber(
    userId: string,
    trackingNumber: string,
  ): Promise<ShipmentWithRelations | null> {
    return this.prisma.shipment.findFirst({
      where: { userId, trackingNumber },
      include: withRelations,
    });
  }

  findByIdForUser(
    userId: string,
    id: string,
  ): Promise<ShipmentWithRelations | null> {
    return this.prisma.shipment.findFirst({
      where: { userId, id },
      include: withRelations,
    });
  }

  existsByTrackingNumber(trackingNumber: string): Promise<boolean> {
    return this.prisma.shipment
      .count({ where: { trackingNumber } })
      .then((count) => count > 0);
  }

  // Booking menyentuh shipments + shipment_items + shipment_events
  // (+ recipients bila disimpan) — wajib satu transaksi (§4.3).
  async create(data: CreateShipmentData): Promise<ShipmentWithRelations> {
    const { item, saveRecipient, ...shipment } = data;

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.shipment.create({
        data: {
          ...shipment,
          outstandingAmount: shipment.totalAmount,
          items: { create: item },
          events: {
            create: {
              status: 'PENDING_PAYMENT',
              notes: 'Booking dibuat',
            },
          },
        },
        include: withRelations,
      });

      if (saveRecipient) {
        await tx.recipient.create({
          data: {
            userId: data.userId,
            name: data.recipientName,
            phone: data.recipientPhone,
            address: data.recipientAddress,
            city: data.recipientCity,
            postalCode: data.recipientPostalCode,
          },
        });
      }

      return created;
    });
  }

  async update(
    id: string,
    data: Prisma.ShipmentUpdateInput,
    itemDescription?: string,
  ): Promise<ShipmentWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      if (itemDescription !== undefined) {
        const first = await tx.shipmentItem.findFirst({
          where: { shipmentId: id },
          orderBy: { createdAt: 'asc' },
        });
        if (first) {
          await tx.shipmentItem.update({
            where: { id: first.id },
            data: { description: itemDescription },
          });
        }
      }

      return tx.shipment.update({
        where: { id },
        data,
        include: withRelations,
      });
    });
  }

  // Perubahan status selalu disertai satu event baru — shipment_events
  // bersifat append-only (§5.3.3).
  async applyStatusChange(
    id: string,
    data: {
      status: ShipmentStatus;
      previousStatus?: ShipmentStatus | null;
      cancelReason?: string | null;
    },
    event: {
      status: ShipmentStatus;
      notes?: string | null;
      location?: string | null;
    },
  ): Promise<ShipmentWithRelations> {
    return this.prisma.shipment.update({
      where: { id },
      data: {
        ...data,
        events: {
          create: {
            status: event.status,
            notes: event.notes ?? null,
            location: event.location ?? null,
          },
        },
      },
      include: withRelations,
    });
  }

  countByStatusForUser(userId: string) {
    return this.prisma.shipment.groupBy({
      by: ['status'],
      where: { userId },
      _count: { _all: true },
    });
  }

  findRecentByUser(userId: string, take: number) {
    return this.prisma.shipment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  private buildWhere(
    userId: string,
    filters: {
      status?: ShipmentStatus;
      serviceType?: Prisma.ShipmentWhereInput['serviceType'];
      search?: string;
      trackingNumber?: string;
      dateFrom?: Date;
      dateTo?: Date;
    },
  ): Prisma.ShipmentWhereInput {
    const where: Prisma.ShipmentWhereInput = { userId };

    if (filters.status) where.status = filters.status;
    if (filters.serviceType) where.serviceType = filters.serviceType;

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {
        ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
        ...(filters.dateTo ? { lte: filters.dateTo } : {}),
      };
    }

    if (filters.search) {
      where.OR = [
        { trackingNumber: { contains: filters.search, mode: 'insensitive' } },
        { recipientName: { contains: filters.search, mode: 'insensitive' } },
        // Pencarian resi tanpa tanda hubung, mis. "lgs260901k7qmr".
        ...(filters.trackingNumber
          ? [{ trackingNumber: filters.trackingNumber }]
          : []),
      ];
    }

    return where;
  }
}
