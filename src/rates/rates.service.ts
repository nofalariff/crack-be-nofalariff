import { Injectable } from '@nestjs/common';
import { ServiceType } from '@prisma/client';
import { DomainException } from '../common/exceptions/domain.exception';
import { calculateTariff } from '../common/utils/money';
import { RoutesService } from '../routes/routes.service';
import { CalculateRateDto } from './dto/calculate-rate.dto';

export const MAX_WEIGHT_KG = 1000;

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
  constructor(private readonly routesService: RoutesService) {}

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

    const { route, pricePerKg, minChargeableWeight, baseFee } =
      await this.routesService.getPricing(dto.serviceType, dto.destinationCode);

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
