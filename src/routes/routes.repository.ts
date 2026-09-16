import { Injectable } from '@nestjs/common';
import { Prisma, ServiceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const withActiveRate = {
  rates: { where: { isActive: true }, take: 1 },
} satisfies Prisma.RouteInclude;

export type RouteWithActiveRate = Prisma.RouteGetPayload<{
  include: typeof withActiveRate;
}>;

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

  create(data: {
    serviceType: ServiceType;
    destinationCode: string;
    destinationName: string;
    destinationRegion: string;
    estimatedDays: number;
    isActive?: boolean;
  }): Promise<RouteWithActiveRate> {
    return this.prisma.route.create({ data, include: withActiveRate });
  }

  update(
    id: string,
    data: Prisma.RouteUpdateInput,
  ): Promise<RouteWithActiveRate> {
    return this.prisma.route.update({
      where: { id },
      data,
      include: withActiveRate,
    });
  }

  // Menonaktifkan tarif aktif lama (bila ada) dan membuat baris tarif baru
  // dalam satu transaksi — riwayat tarif dipertahankan (planbackend.md §5.5).
  async setRate(
    routeId: string,
    data: { pricePerKg: bigint; minChargeableWeight: number; baseFee: bigint },
  ): Promise<RouteWithActiveRate> {
    await this.prisma.$transaction([
      this.prisma.rate.updateMany({
        where: { routeId, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.rate.create({
        data: { routeId, ...data, isActive: true },
      }),
    ]);

    return (await this.findById(routeId))!;
  }
}
