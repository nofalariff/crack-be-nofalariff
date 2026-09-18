import { Injectable } from '@nestjs/common';
import { ShipmentStatus } from '@prisma/client';
import { Paginated } from '../common/dto/pagination-meta';
import { DomainException } from '../common/exceptions/domain.exception';
import { calculateTariff } from '../common/utils/money';
import {
  canonicalizeTrackingNumber,
  generateTrackingNumber,
} from '../common/utils/tracking-number';
import { AuthRepository } from '../auth/auth.repository';
import { MAX_WEIGHT_KG } from '../rates/rates.service';
import { RoutesService } from '../routes/routes.service';
import { CancelShipmentDto } from './dto/cancel-shipment.dto';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ListShipmentsQueryDto } from './dto/list-shipments-query.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import {
  ShipmentDetailView,
  ShipmentSummaryView,
  ShipmentWithRelations,
  toShipmentDetail,
  toShipmentSummary,
} from './shipment.view';
import { ShipmentsRepository } from './shipments.repository';

const EDITABLE_STATUSES: ShipmentStatus[] = ['PENDING_PAYMENT', 'PAID'];
const CANCELLABLE_STATUSES: ShipmentStatus[] = ['PENDING_PAYMENT'];
const DEFAULT_CANCEL_REASON = 'Dibatalkan oleh pemesan';
const TRACKING_NUMBER_ATTEMPTS = 5;

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly repo: ShipmentsRepository,
    private readonly routesService: RoutesService,
    private readonly authRepo: AuthRepository,
  ) {}

  async list(
    userId: string,
    query: ListShipmentsQueryDto,
  ): Promise<Paginated<ShipmentSummaryView>> {
    const [rows, total] = await this.repo.findManyByUser(
      userId,
      {
        status: query.status,
        serviceType: query.serviceType,
        search: query.search,
        trackingNumber: query.search
          ? (canonicalizeTrackingNumber(query.search) ?? undefined)
          : undefined,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? endOfDay(query.dateTo) : undefined,
      },
      { page: query.page, limit: query.limit },
    );

    return {
      data: rows.map((row) => toShipmentSummary(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async create(
    userId: string,
    dto: CreateShipmentDto,
  ): Promise<ShipmentDetailView> {
    await this.assertBookingAllowed(userId);

    if (!dto.prohibitedItemsAgreed) {
      throw new DomainException(
        'PROHIBITED_ITEMS_NOT_AGREED',
        'Pernyataan barang terlarang belum disetujui.',
      );
    }
    if (dto.declaredWeight > MAX_WEIGHT_KG) {
      throw new DomainException(
        'WEIGHT_EXCEEDS_LIMIT',
        `Berat melebihi batas ${MAX_WEIGHT_KG} kg per kiriman.`,
      );
    }

    const pricing = await this.routesService.getPricing(
      dto.serviceType,
      dto.destinationCode,
    );
    const tariff = calculateTariff({
      weightKg: dto.declaredWeight,
      minChargeableWeight: pricing.minChargeableWeight,
      pricePerKg: pricing.pricePerKg,
      baseFee: pricing.baseFee,
    });

    const shipment = await this.repo.create({
      userId,
      routeId: pricing.route.id,
      trackingNumber: await this.nextTrackingNumber(),
      serviceType: pricing.route.serviceType,
      destinationCode: pricing.route.destinationCode,
      destinationName: pricing.route.destinationName,
      estimatedDays: pricing.route.estimatedDays,
      senderName: dto.senderName,
      senderPhone: dto.senderPhone,
      recipientName: dto.recipientName,
      recipientPhone: dto.recipientPhone,
      recipientAddress: dto.recipientAddress,
      recipientCity: dto.recipientCity,
      recipientPostalCode: dto.recipientPostalCode ?? null,
      declaredWeight: dto.declaredWeight,
      chargeableWeight: tariff.chargeableWeight,
      totalColli: dto.totalColli,
      pricePerKgSnapshot: pricing.pricePerKg,
      baseFeeSnapshot: pricing.baseFee,
      minChargeableWeightSnapshot: pricing.minChargeableWeight,
      totalAmount: tariff.total,
      notes: dto.notes ?? null,
      prohibitedItemsAgreedAt: new Date(),
      item: {
        description: dto.itemDescription,
        quantity: dto.totalColli,
        weight: dto.declaredWeight,
        declaredValue:
          dto.declaredValue === undefined ? null : BigInt(dto.declaredValue),
      },
      saveRecipient: dto.saveRecipient ?? false,
    });

    return toShipmentDetail(shipment);
  }

  async findByTrackingNumber(
    userId: string,
    trackingNumber: string,
  ): Promise<ShipmentDetailView> {
    // Pencarian mengabaikan huruf besar-kecil dan tanda hubung (§7.1).
    const canonical = canonicalizeTrackingNumber(trackingNumber);
    const shipment = canonical
      ? await this.repo.findByTrackingNumber(userId, canonical)
      : null;

    if (!shipment) {
      throw new DomainException('NOT_FOUND', 'Kiriman tidak ditemukan.');
    }
    return toShipmentDetail(shipment);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateShipmentDto,
  ): Promise<ShipmentDetailView> {
    const shipment = await this.getOwnedOrThrow(userId, id);

    if (!EDITABLE_STATUSES.includes(shipment.status)) {
      throw new DomainException(
        'SHIPMENT_NOT_EDITABLE',
        'Kiriman ini sudah tidak dapat diubah.',
      );
    }

    const data: {
      recipientName?: string;
      recipientPhone?: string;
      recipientAddress?: string;
      recipientCity?: string;
      recipientPostalCode?: string | null;
      notes?: string | null;
    } = {};

    if (dto.recipientName !== undefined) data.recipientName = dto.recipientName;
    if (dto.recipientPhone !== undefined)
      data.recipientPhone = dto.recipientPhone;
    if (dto.recipientAddress !== undefined)
      data.recipientAddress = dto.recipientAddress;
    if (dto.recipientCity !== undefined) data.recipientCity = dto.recipientCity;
    // String kosong mengosongkan nilai untuk dua field ini.
    if (dto.recipientPostalCode !== undefined)
      data.recipientPostalCode = dto.recipientPostalCode || null;
    if (dto.notes !== undefined) data.notes = dto.notes || null;

    const updated = await this.repo.update(
      shipment.id,
      data,
      dto.itemDescription,
    );
    return toShipmentDetail(updated);
  }

  async cancel(
    userId: string,
    id: string,
    dto: CancelShipmentDto,
  ): Promise<ShipmentDetailView> {
    const shipment = await this.getOwnedOrThrow(userId, id);

    // Customer dan agen hanya boleh membatalkan sebelum pembayaran (§7.6).
    if (!CANCELLABLE_STATUSES.includes(shipment.status)) {
      throw new DomainException(
        'SHIPMENT_NOT_CANCELLABLE',
        'Kiriman ini sudah tidak dapat dibatalkan.',
      );
    }

    const reason = dto.reason ?? DEFAULT_CANCEL_REASON;
    const cancelled = await this.repo.applyStatusChange(
      shipment.id,
      { status: 'CANCELLED', cancelReason: reason },
      { status: 'CANCELLED', notes: reason },
    );

    return toShipmentDetail(cancelled);
  }

  // Booking ulang dari kiriman lama: data isian disalin, tetapi tarif dihitung
  // ulang memakai tarif yang berlaku sekarang karena ini kiriman baru.
  async duplicate(userId: string, id: string): Promise<ShipmentDetailView> {
    const source = await this.getOwnedOrThrow(userId, id);
    await this.assertBookingAllowed(userId);

    const pricing = await this.routesService.getPricing(
      source.serviceType,
      source.destinationCode,
    );
    const tariff = calculateTariff({
      weightKg: source.declaredWeight,
      minChargeableWeight: pricing.minChargeableWeight,
      pricePerKg: pricing.pricePerKg,
      baseFee: pricing.baseFee,
    });
    const sourceItem = source.items[0];

    const created = await this.repo.create({
      userId,
      routeId: pricing.route.id,
      trackingNumber: await this.nextTrackingNumber(),
      serviceType: pricing.route.serviceType,
      destinationCode: pricing.route.destinationCode,
      destinationName: pricing.route.destinationName,
      estimatedDays: pricing.route.estimatedDays,
      senderName: source.senderName,
      senderPhone: source.senderPhone,
      recipientName: source.recipientName,
      recipientPhone: source.recipientPhone,
      recipientAddress: source.recipientAddress,
      recipientCity: source.recipientCity,
      recipientPostalCode: source.recipientPostalCode,
      declaredWeight: source.declaredWeight,
      chargeableWeight: tariff.chargeableWeight,
      totalColli: source.totalColli,
      pricePerKgSnapshot: pricing.pricePerKg,
      baseFeeSnapshot: pricing.baseFee,
      minChargeableWeightSnapshot: pricing.minChargeableWeight,
      totalAmount: tariff.total,
      notes: source.notes,
      prohibitedItemsAgreedAt: new Date(),
      item: {
        description: sourceItem?.description ?? 'Barang kiriman',
        quantity: source.totalColli,
        weight: source.declaredWeight,
        declaredValue: sourceItem?.declaredValue ?? null,
      },
      saveRecipient: false,
    });

    return toShipmentDetail(created);
  }

  private async getOwnedOrThrow(
    userId: string,
    id: string,
  ): Promise<ShipmentWithRelations> {
    const shipment = await this.repo.findByIdForUser(userId, id);
    // 404, bukan 403 — keberadaan data milik orang lain tidak boleh terbaca
    // (planbackend.md §7.8).
    if (!shipment) {
      throw new DomainException('NOT_FOUND', 'Kiriman tidak ditemukan.');
    }
    return shipment;
  }

  // Status persetujuan agen dibaca dari database, bukan dari klaim JWT, agar
  // agen yang baru disetujui langsung bisa booking tanpa login ulang (§7.8).
  private async assertBookingAllowed(userId: string): Promise<void> {
    const user = await this.authRepo.findUserById(userId);
    if (!user) {
      throw new DomainException('UNAUTHORIZED');
    }
    if (
      user.role === 'AGENT' &&
      user.agentProfile?.approvalStatus !== 'APPROVED'
    ) {
      throw new DomainException(
        'AGENT_NOT_APPROVED',
        'Akun agen Anda masih menunggu persetujuan admin.',
      );
    }
  }

  // Dipakai juga oleh booking walk-in dari sisi admin.
  async nextTrackingNumber(): Promise<string> {
    for (let attempt = 0; attempt < TRACKING_NUMBER_ATTEMPTS; attempt += 1) {
      const candidate = generateTrackingNumber();
      if (!(await this.repo.existsByTrackingNumber(candidate))) {
        return candidate;
      }
    }
    throw new DomainException(
      'INTERNAL_ERROR',
      'Gagal membuat nomor resi. Silakan coba lagi.',
    );
  }
}

function endOfDay(value: string): Date {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}
