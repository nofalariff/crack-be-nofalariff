import { Injectable } from '@nestjs/common';
import { ServiceType } from '@prisma/client';
import { DomainException } from '../common/exceptions/domain.exception';
import { CreateRouteDto } from './dto/create-route.dto';
import { SetRateDto } from './dto/set-rate.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { RouteWithActiveRate, RoutesRepository } from './routes.repository';

export interface RouteView {
  id: string;
  serviceType: ServiceType;
  destinationCode: string;
  destinationName: string;
  destinationRegion: string;
  estimatedDays: number;
  isActive: boolean;
  pricePerKg: number;
  minChargeableWeight: number;
  baseFee: number;
}

export interface AdminRouteView extends RouteView {
  activeShipmentCount: number;
}

export interface RoutePricing {
  route: RouteWithActiveRate;
  pricePerKg: bigint;
  minChargeableWeight: number;
  baseFee: bigint;
}

@Injectable()
export class RoutesService {
  constructor(private readonly repo: RoutesRepository) {}

  async listActive(serviceType?: ServiceType): Promise<RouteView[]> {
    const routes = await this.repo.findActive(serviceType);
    return routes.map((route) => this.toRouteView(route));
  }

  async listForAdmin(): Promise<AdminRouteView[]> {
    const [routes, activeCounts] = await Promise.all([
      this.repo.findAllForAdmin(),
      this.repo.countActiveShipmentsPerRoute(),
    ]);

    return routes.map((route) =>
      this.toAdminRouteView(route, activeCounts.get(route.id) ?? 0),
    );
  }

  // Satu-satunya tempat rute diterjemahkan menjadi tarif yang dapat dipakai —
  // dipakai kalkulator ongkir dan booking agar aturannya tidak bercabang.
  async getPricing(
    serviceType: ServiceType,
    destinationCode: string,
  ): Promise<RoutePricing> {
    const route = await this.repo.findByServiceAndCode(
      serviceType,
      destinationCode,
    );
    if (!route) {
      throw new DomainException(
        'ROUTE_NOT_SERVED',
        'Rute ini belum kami layani.',
      );
    }
    if (!route.isActive) {
      throw new DomainException(
        'ROUTE_INACTIVE',
        'Rute ini sedang tidak tersedia.',
      );
    }

    // Rute tanpa tarif aktif dianggap belum dilayani (planbackend.md §6.3).
    const activeRate = route.rates[0];
    if (!activeRate) {
      throw new DomainException(
        'ROUTE_NOT_SERVED',
        'Rute ini belum kami layani.',
      );
    }

    return {
      route,
      pricePerKg: activeRate.pricePerKg,
      minChargeableWeight: activeRate.minChargeableWeight,
      baseFee: activeRate.baseFee,
    };
  }

  async create(dto: CreateRouteDto): Promise<AdminRouteView> {
    const existing = await this.repo.findByServiceAndCode(
      dto.serviceType,
      dto.destinationCode,
    );
    if (existing) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Kode tujuan ini sudah dipakai pada layanan yang sama.',
        [{ field: 'destinationCode', message: 'Kode tujuan sudah dipakai.' }],
      );
    }

    const route = await this.repo.create(dto);
    return this.toAdminRouteView(route, 0);
  }

  async update(id: string, dto: UpdateRouteDto): Promise<AdminRouteView> {
    const existing = await this.getOrThrow(id);

    const data: {
      destinationName?: string;
      destinationRegion?: string;
      estimatedDays?: number;
      isActive?: boolean;
    } = {};
    if (dto.destinationName !== undefined)
      data.destinationName = dto.destinationName;
    if (dto.destinationRegion !== undefined)
      data.destinationRegion = dto.destinationRegion;
    if (dto.estimatedDays !== undefined) data.estimatedDays = dto.estimatedDays;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const route =
      Object.keys(data).length > 0
        ? await this.repo.update(id, data)
        : existing;

    return this.toAdminRouteView(
      route,
      await this.repo.countActiveShipmentsForRoute(id),
    );
  }

  async setRate(id: string, dto: SetRateDto): Promise<AdminRouteView> {
    await this.getOrThrow(id);

    if (dto.pricePerKg <= 0 || dto.minChargeableWeight <= 0) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Harga per kg dan berat minimum harus lebih besar dari nol.',
      );
    }

    const route = await this.repo.setRate(id, {
      pricePerKg: BigInt(dto.pricePerKg),
      minChargeableWeight: dto.minChargeableWeight,
      baseFee: BigInt(dto.baseFee),
    });
    return this.toAdminRouteView(
      route,
      await this.repo.countActiveShipmentsForRoute(id),
    );
  }

  private async getOrThrow(id: string): Promise<RouteWithActiveRate> {
    const route = await this.repo.findById(id);
    if (!route) {
      throw new DomainException('NOT_FOUND', 'Rute tidak ditemukan.');
    }
    return route;
  }

  private toRouteView(route: RouteWithActiveRate): RouteView {
    const activeRate = route.rates[0];
    return {
      id: route.id,
      serviceType: route.serviceType,
      destinationCode: route.destinationCode,
      destinationName: route.destinationName,
      destinationRegion: route.destinationRegion,
      estimatedDays: route.estimatedDays,
      isActive: route.isActive,
      pricePerKg: activeRate ? Number(activeRate.pricePerKg) : 0,
      minChargeableWeight: activeRate ? activeRate.minChargeableWeight : 1,
      baseFee: activeRate ? Number(activeRate.baseFee) : 0,
    };
  }

  private toAdminRouteView(
    route: RouteWithActiveRate,
    activeShipmentCount: number,
  ): AdminRouteView {
    return {
      ...this.toRouteView(route),
      activeShipmentCount,
    };
  }
}
