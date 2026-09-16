import { Injectable } from '@nestjs/common';
import { ServiceType } from '@prisma/client';
import { calculateTariff } from '../common/utils/money';
import { DomainException } from '../common/exceptions/domain.exception';
import { RoutesRepository } from '../routes/routes.repository';
import { CalculateRateDto } from './dto/calculate-rate.dto';

const MAX_WEIGHT_KG = 1000;

export interface RateCalculationView {
  serviceType: ServiceType;
  destinationCode: string;
  destinationName: string;
  estimatedDays: number;
  inputWeight: number;
  chargeableWeight: number;
  pricePerKg: number;
  weightFee: number;
  baseFee: number;
  total: number;
}

@Injectable()
export class RatesService {
  constructor(private readonly routesRepo: RoutesRepository) {}

  async calculate(dto: CalculateRateDto): Promise<RateCalculationView> {
    if (!dto.weight || dto.weight <= 0) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Berat harus lebih dari 0 kg.',
        [{ field: 'weight', message: 'Berat harus lebih dari 0 kg.' }],
      );
    }
    if (dto.weight > MAX_WEIGHT_KG) {
      throw new DomainException(
        'WEIGHT_EXCEEDS_LIMIT',
        `Berat melebihi batas ${MAX_WEIGHT_KG} kg per kiriman.`,
      );
    }

    const route = await this.routesRepo.findByServiceAndCode(
      dto.serviceType,
      dto.destinationCode,
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

    const activeRate = route.rates[0];
    const pricePerKg = activeRate?.pricePerKg ?? 0n;
    const minChargeableWeight = activeRate?.minChargeableWeight ?? 1;
    const baseFee = activeRate?.baseFee ?? 0n;

    const { chargeableWeight, weightFee, total } = calculateTariff({
      weightKg: dto.weight,
      minChargeableWeight,
      pricePerKg,
      baseFee,
    });

    return {
      serviceType: route.serviceType,
      destinationCode: route.destinationCode,
      destinationName: route.destinationName,
      estimatedDays: route.estimatedDays,
      inputWeight: dto.weight,
      chargeableWeight,
      pricePerKg: Number(pricePerKg),
      weightFee: Number(weightFee),
      baseFee: Number(baseFee),
      total: Number(total),
    };
  }
}
