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
  minChargeableWeightSnapshot: number;
  totalAmount: bigint;
  notes: string | null;
  prohibitedItemsAgreedAt: Date;
  initialEventNotes?: string;
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
    const { item, saveRecipient, initialEventNotes, ...shipment } = data;

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.shipment.create({
        data: {
          ...shipment,
          outstandingAmount: shipment.totalAmount,
          items: { create: item },
          events: {
            create: {
              status: 'PENDING_PAYMENT',
              notes: initialEventNotes ?? 'Booking dibuat',
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

  // --- Sisi admin ---

  findManyForAdmin(
    filters: {
      status?: ShipmentStatus;
      serviceType?: Prisma.ShipmentWhereInput['serviceType'];
      paymentStatus?: Prisma.ShipmentWhereInput['paymentStatus'];
      destinationCode?: string;
      search?: string;
      trackingNumber?: string;
      dateFrom?: Date;
      dateTo?: Date;
    },
    pagination: { page: number; limit: number },
  ) {
    const where = this.buildAdminWhere(filters);

    return this.prisma.$transaction([
      this.prisma.shipment.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.shipment.count({ where }),
    ]);
  }

  findByIdForAdmin(id: string) {
    return this.prisma.shipment.findUnique({
      where: { id },
      include: { ...withRelations, user: true },
    });
  }

  findByTrackingNumberForAdmin(trackingNumber: string) {
    return this.prisma.shipment.findUnique({
      where: { trackingNumber },
      include: { ...withRelations, user: true },
    });
  }

  findManyByIds(ids: string[]) {
    return this.prisma.shipment.findMany({ where: { id: { in: ids } } });
  }

  // Satu transisi status: kiriman + event baru + baris audit dalam satu
  // transaksi (§4.3, §7.3 aturan 4).
  async applyStatusTransition(
    id: string,
    data: {
      status: ShipmentStatus;
      previousStatus?: ShipmentStatus | null;
      deliveredTo?: string | null;
      cancelReason?: string | null;
    },
    event: { status: ShipmentStatus; notes?: string; location?: string },
    audit: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.shipment.update({
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
        include: { ...withRelations, user: true },
      });

      await audit(tx);
      return updated;
    });
  }

  async applyWeightCorrection(
    id: string,
    data: {
      actualWeight: number;
      chargeableWeight: number;
      totalAmount: bigint;
      outstandingAmount: bigint;
    },
    event: { notes: string; status: ShipmentStatus } | null,
    audit: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.shipment.update({
        where: { id },
        data: {
          ...data,
          ...(event
            ? {
                events: {
                  create: { status: event.status, notes: event.notes },
                },
              }
            : {}),
        },
        include: { ...withRelations, user: true },
      });

      await audit(tx);
      return updated;
    });
  }

  countPendingPaymentVerification(): Promise<number> {
    return this.prisma.shipment.count({
      where: { payments: { some: { status: 'WAITING_VERIFICATION' } } },
    });
  }

  countAll(): Promise<number> {
    return this.prisma.shipment.count();
  }

  countActive(): Promise<number> {
    return this.prisma.shipment.count({
      where: { status: { notIn: ['DELIVERED', 'CANCELLED'] } },
    });
  }

  countByStatus() {
    return this.prisma.shipment.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
  }

  // Kiriman aktif yang tidak bergerak lebih dari 3 hari (§6.5).
  findStalled(before: Date, take?: number) {
    return this.prisma.shipment.findMany({
      where: {
        status: { notIn: ['DELIVERED', 'CANCELLED'] },
        updatedAt: { lt: before },
      },
      include: { user: true },
      orderBy: { updatedAt: 'asc' },
      ...(take ? { take } : {}),
    });
  }

  countStalled(before: Date): Promise<number> {
    return this.prisma.shipment.count({
      where: {
        status: { notIn: ['DELIVERED', 'CANCELLED'] },
        updatedAt: { lt: before },
      },
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

  // Pencarian admin lebih luas: resi, pengirim, penerima, nomor HP, dan
  // email pemesan (FR-ADM-01).
  private buildAdminWhere(filters: {
    status?: ShipmentStatus;
    serviceType?: Prisma.ShipmentWhereInput['serviceType'];
    paymentStatus?: Prisma.ShipmentWhereInput['paymentStatus'];
    destinationCode?: string;
    search?: string;
    trackingNumber?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Prisma.ShipmentWhereInput {
    const where: Prisma.ShipmentWhereInput = {};

    if (filters.status) where.status = filters.status;
    if (filters.serviceType) where.serviceType = filters.serviceType;
    if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;
    if (filters.destinationCode)
      where.destinationCode = filters.destinationCode;

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {
        ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
        ...(filters.dateTo ? { lte: filters.dateTo } : {}),
      };
    }

    if (filters.search) {
      const insensitive = {
        contains: filters.search,
        mode: 'insensitive' as const,
      };
      where.OR = [
        { trackingNumber: insensitive },
        { senderName: insensitive },
        { recipientName: insensitive },
        { senderPhone: { contains: filters.search } },
        { recipientPhone: { contains: filters.search } },
        { user: { email: insensitive } },
        ...(filters.trackingNumber
          ? [{ trackingNumber: filters.trackingNumber }]
          : []),
      ];
    }

    return where;
  }
}
