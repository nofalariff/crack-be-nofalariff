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

@Injectable()
export class RoutesService {
  constructor(private readonly repo: RoutesRepository) {}

  async listActive(serviceType?: ServiceType): Promise<RouteView[]> {
    const routes = await this.repo.findActive(serviceType);
    return routes.map((route) => this.toRouteView(route));
  }

  async listForAdmin(): Promise<AdminRouteView[]> {
    const routes = await this.repo.findAllForAdmin();
    return routes.map((route) => this.toAdminRouteView(route));
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
    return this.toAdminRouteView(route);
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

    return this.toAdminRouteView(route);
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
    return this.toAdminRouteView(route);
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

  private toAdminRouteView(route: RouteWithActiveRate): AdminRouteView {
    return {
      ...this.toRouteView(route),
      // Dihitung dari data kiriman sungguhan mulai milestone B4.
      activeShipmentCount: 0,
    };
  }
}
