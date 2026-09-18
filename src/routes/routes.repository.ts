import { Injectable } from '@nestjs/common';
import { Prisma, ServiceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const withActiveRate = {
  rates: { where: { isActive: true }, take: 1 },
} satisfies Prisma.RouteInclude;

export type RouteWithActiveRate = Prisma.RouteGetPayload<{
  include: typeof withActiveRate;
}>;

// Pencatatan audit ikut dalam transaksi aksinya, sehingga jejaknya batal juga
// bila aksinya gagal di tengah jalan (§4.3).
export type AuditWriter = (
  tx: Prisma.TransactionClient,
  routeId: string,
) => Promise<void>;

@Injectable()
export class RoutesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActive(serviceType?: ServiceType): Promise<RouteWithActiveRate[]> {
    return this.prisma.route.findMany({
      where: { isActive: true, ...(serviceType ? { serviceType } : {}) },
      include: withActiveRate,
      orderBy: { destinationName: 'asc' },
    });
  }

  findAllForAdmin(): Promise<RouteWithActiveRate[]> {
    return this.prisma.route.findMany({
      include: withActiveRate,
      orderBy: { createdAt: 'asc' },
    });
  }

  findById(id: string): Promise<RouteWithActiveRate | null> {
    return this.prisma.route.findUnique({
      where: { id },
      include: withActiveRate,
    });
  }

  findByServiceAndCode(
    serviceType: ServiceType,
    destinationCode: string,
  ): Promise<RouteWithActiveRate | null> {
    return this.prisma.route.findUnique({
      where: { serviceType_destinationCode: { serviceType, destinationCode } },
      include: withActiveRate,
    });
  }

  create(
    data: {
      serviceType: ServiceType;
      destinationCode: string;
      destinationName: string;
      destinationRegion: string;
      estimatedDays: number;
      isActive?: boolean;
    },
    audit: AuditWriter,
  ): Promise<RouteWithActiveRate> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.route.create({ data, include: withActiveRate });
      await audit(tx, created.id);
      return created;
    });
  }

  async update(
    id: string,
    data: Prisma.RouteUpdateInput,
    audit: AuditWriter,
  ): Promise<RouteWithActiveRate> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.route.update({
        where: { id },
        data,
        include: withActiveRate,
      });
      await audit(tx, updated.id);
      return updated;
    });
  }

  // Kiriman yang belum selesai pada sebuah rute (§6.5). Dihitung sekali untuk
  // seluruh rute agar daftar admin tidak memicu query per baris.
  async countActiveShipmentsPerRoute(): Promise<Map<string, number>> {
    const grouped = await this.prisma.shipment.groupBy({
      by: ['routeId'],
      where: { status: { notIn: ['DELIVERED', 'CANCELLED'] } },
      _count: { _all: true },
    });

    return new Map(grouped.map((row) => [row.routeId, row._count._all]));
  }

  countActiveShipmentsForRoute(routeId: string): Promise<number> {
    return this.prisma.shipment.count({
      where: { routeId, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
    });
  }

  // Menonaktifkan tarif aktif lama (bila ada) dan membuat baris tarif baru
  // dalam satu transaksi — riwayat tarif dipertahankan (planbackend.md §5.5).
  async setRate(
    routeId: string,
    data: { pricePerKg: bigint; minChargeableWeight: number; baseFee: bigint },
    audit: AuditWriter,
  ): Promise<RouteWithActiveRate> {
    await this.prisma.$transaction(async (tx) => {
      await tx.rate.updateMany({
        where: { routeId, isActive: true },
        data: { isActive: false },
      });
      await tx.rate.create({ data: { routeId, ...data, isActive: true } });
      await audit(tx, routeId);
    });

    return (await this.findById(routeId))!;
  }
}
