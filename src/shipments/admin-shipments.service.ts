import { Injectable } from '@nestjs/common';
import { Shipment, ShipmentStatus, User } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthRepository } from '../auth/auth.repository';
import { Paginated } from '../common/dto/pagination-meta';
import { DomainException } from '../common/exceptions/domain.exception';
import { calculateTariff } from '../common/utils/money';
import { canonicalizeTrackingNumber } from '../common/utils/tracking-number';
import { MAX_WEIGHT_KG } from '../rates/rates.service';
import { RoutesService } from '../routes/routes.service';
import {
  AdminShipmentDetailView,
  AdminShipmentSummaryView,
  BulkStatusResultView,
  WeightCorrectionResultView,
  toAdminShipmentDetail,
  toAdminShipmentSummary,
} from './admin-shipment.view';
import { AdminListShipmentsQueryDto } from './dto/admin-list-shipments-query.dto';
import { BulkStatusDto } from './dto/bulk-status.dto';
import { ManifestQueryDto } from './dto/manifest-query.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { WalkInShipmentDto } from './dto/walk-in-shipment.dto';
import { WeightCorrectionDto } from './dto/weight-correction.dto';
import {
  ManifestGroupView,
  ManifestView,
  ShipmentLabelView,
} from './manifest.view';
import { checkTransition, nextPreviousStatus } from './shipment-status';
import { ShipmentsService } from './shipments.service';
import { ShipmentsRepository } from './shipments.repository';

// Manifest bawaan memuat kiriman yang sudah siap berangkat dari gudang.
const MANIFEST_DEFAULT_STATUSES: ShipmentStatus[] = [
  'RECEIVED_AT_WAREHOUSE',
  'IN_TRANSIT',
];

// Koreksi berat hanya masuk akal selama barang masih di tangan operasional.
const WEIGHT_CORRECTABLE_STATUSES: ShipmentStatus[] = [
  'PENDING_PAYMENT',
  'PAID',
  'RECEIVED_AT_WAREHOUSE',
  'IN_TRANSIT',
  'ON_HOLD',
];

@Injectable()
export class AdminShipmentsService {
  constructor(
    private readonly repo: ShipmentsRepository,
    private readonly shipmentsService: ShipmentsService,
    private readonly routesService: RoutesService,
    private readonly authRepo: AuthRepository,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: AdminListShipmentsQueryDto,
  ): Promise<Paginated<AdminShipmentSummaryView>> {
    const [rows, total] = await this.repo.findManyForAdmin(
      {
        status: query.status,
        serviceType: query.serviceType,
        paymentStatus: query.paymentStatus,
        destinationCode: query.destinationCode,
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
      data: rows.map((row) => toAdminShipmentSummary(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  // Menerima id maupun nomor resi supaya halaman detail admin bisa dibuka
  // dari mana saja.
  async detail(idOrTrackingNumber: string): Promise<AdminShipmentDetailView> {
    const shipment = await this.findByIdOrTrackingNumber(idOrTrackingNumber);
    return toAdminShipmentDetail(shipment);
  }

  // Data label untuk ditempel di koli — dicetak di sisi klien.
  async label(idOrTrackingNumber: string): Promise<ShipmentLabelView> {
    const shipment = await this.findByIdOrTrackingNumber(idOrTrackingNumber);

    return {
      trackingNumber: shipment.trackingNumber,
      serviceType: shipment.serviceType,
      destinationCode: shipment.destinationCode,
      destinationName: shipment.destinationName,
      estimatedDays: shipment.estimatedDays,
      status: shipment.status,
      createdAt: shipment.createdAt,
      sender: { name: shipment.senderName, phone: shipment.senderPhone },
      recipient: {
        name: shipment.recipientName,
        phone: shipment.recipientPhone,
        address: shipment.recipientAddress,
        city: shipment.recipientCity,
        postalCode: shipment.recipientPostalCode,
      },
      totalColli: shipment.totalColli,
      chargeableWeight: shipment.chargeableWeight,
      declaredWeight: shipment.declaredWeight,
      actualWeight: shipment.actualWeight,
      totalAmount: Number(shipment.totalAmount),
      paymentStatus: shipment.paymentStatus,
      itemSummary: shipment.items.map((item) => item.description).join(', '),
      notes: shipment.notes,
    };
  }

  // Manifest muatan: kiriman yang siap berangkat, dikelompokkan per tujuan.
  async manifest(query: ManifestQueryDto): Promise<ManifestView> {
    const statuses: ShipmentStatus[] = query.status
      ? [query.status]
      : MANIFEST_DEFAULT_STATUSES;

    const rows = await this.repo.findForManifest({
      statuses,
      destinationCode: query.destinationCode,
      serviceType: query.serviceType,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? endOfDay(query.dateTo) : undefined,
    });

    const groups = new Map<string, ManifestGroupView>();
    for (const row of rows) {
      const key = `${row.serviceType}:${row.destinationCode}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          destinationCode: row.destinationCode,
          destinationName: row.destinationName,
          serviceType: row.serviceType,
          shipmentCount: 0,
          totalColli: 0,
          totalChargeableWeight: 0,
          totalAmount: 0,
          shipments: [],
        };
        groups.set(key, group);
      }

      group.shipmentCount += 1;
      group.totalColli += row.totalColli;
      group.totalChargeableWeight += row.chargeableWeight;
      group.totalAmount += Number(row.totalAmount);
      group.shipments.push({
        trackingNumber: row.trackingNumber,
        status: row.status,
        senderName: row.senderName,
        recipientName: row.recipientName,
        recipientCity: row.recipientCity,
        totalColli: row.totalColli,
        chargeableWeight: row.chargeableWeight,
        totalAmount: Number(row.totalAmount),
        createdAt: row.createdAt,
      });
    }

    const list = [...groups.values()];
    return {
      generatedAt: new Date(),
      filters: {
        destinationCode: query.destinationCode ?? null,
        serviceType: query.serviceType ?? null,
        status: statuses,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
      },
      totals: {
        shipmentCount: rows.length,
        totalColli: list.reduce((sum, group) => sum + group.totalColli, 0),
        totalChargeableWeight: list.reduce(
          (sum, group) => sum + group.totalChargeableWeight,
          0,
        ),
        totalAmount: list.reduce((sum, group) => sum + group.totalAmount, 0),
      },
      groups: list,
    };
  }

  async createWalkIn(
    adminId: string,
    dto: WalkInShipmentDto,
  ): Promise<AdminShipmentDetailView> {
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

    const owner = await this.resolveOwner(adminId, dto.onBehalfOfUserId);
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

    const created = await this.repo.create({
      userId: owner.id,
      routeId: pricing.route.id,
      trackingNumber: await this.shipmentsService.nextTrackingNumber(),
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
      initialEventNotes: dto.onBehalfOfUserId
        ? 'Booking dibuat admin atas nama customer'
        : 'Booking walk-in dibuat admin',
      item: {
        description: dto.itemDescription,
        quantity: dto.totalColli,
        weight: dto.declaredWeight,
        declaredValue:
          dto.declaredValue === undefined ? null : BigInt(dto.declaredValue),
      },
      saveRecipient: false,
    });

    await this.audit.record({
      action: 'SHIPMENT_CREATED_BY_ADMIN',
      actorId: adminId,
      entityType: 'shipment',
      entityId: created.id,
      entityLabel: created.trackingNumber,
      after: {
        customer: owner.fullName,
        total: Number(created.totalAmount),
      },
    });

    return toAdminShipmentDetail({ ...created, user: owner });
  }

  async changeStatus(
    adminId: string,
    id: string,
    dto: UpdateStatusDto,
  ): Promise<AdminShipmentDetailView> {
    const shipment = await this.findByIdOrThrow(id);

    const rejection = checkTransition(dto.status, {
      status: shipment.status,
      serviceType: shipment.serviceType,
      previousStatus: shipment.previousStatus,
      deliveredTo: dto.deliveredTo,
      reason: dto.reason,
    });
    if (rejection) {
      throw new DomainException('SHIPMENT_INVALID_TRANSITION', rejection);
    }

    const updated = await this.applyTransition(adminId, shipment, dto.status, {
      location: dto.location,
      notes: dto.notes,
      deliveredTo: dto.deliveredTo,
      reason: dto.reason,
    });

    return toAdminShipmentDetail(updated);
  }

  // Aksi massal melewati yang gagal alih-alih menggagalkan semuanya
  // (FR-TRACK-03).
  async bulkChangeStatus(
    adminId: string,
    dto: BulkStatusDto,
  ): Promise<BulkStatusResultView> {
    const result: BulkStatusResultView = { updatedCount: 0, skipped: [] };
    const uniqueIds = [...new Set(dto.shipmentIds)];
    const found = await this.repo.findManyByIds(uniqueIds);
    const byId = new Map(found.map((row) => [row.id, row]));

    for (const id of uniqueIds) {
      const shipment = byId.get(id);
      if (!shipment) {
        result.skipped.push({
          trackingNumber: id,
          reason: 'Kiriman tidak ditemukan',
        });
        continue;
      }

      // Status yang menuntut alasan atau nama penerima tidak bisa diproses
      // massal karena keduanya khas per kiriman.
      const rejection = checkTransition(dto.status, {
        status: shipment.status,
        serviceType: shipment.serviceType,
        previousStatus: shipment.previousStatus,
      });
      if (rejection) {
        result.skipped.push({
          trackingNumber: shipment.trackingNumber,
          reason: rejection,
        });
        continue;
      }

      await this.applyTransition(adminId, shipment, dto.status, {
        notes: dto.notes,
      });
      result.updatedCount += 1;
    }

    return result;
  }

  async correctWeight(
    adminId: string,
    id: string,
    dto: WeightCorrectionDto,
  ): Promise<WeightCorrectionResultView> {
    const shipment = await this.findByIdOrThrow(id);

    if (!dto.actualWeight || dto.actualWeight <= 0) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Berat harus lebih dari 0 kg.',
        [{ field: 'actualWeight', message: 'Berat harus lebih dari 0 kg.' }],
      );
    }
    if (dto.actualWeight > MAX_WEIGHT_KG) {
      throw new DomainException(
        'WEIGHT_EXCEEDS_LIMIT',
        `Berat melebihi batas ${MAX_WEIGHT_KG} kg per kiriman.`,
      );
    }
    if (!WEIGHT_CORRECTABLE_STATUSES.includes(shipment.status)) {
      throw new DomainException(
        'SHIPMENT_NOT_EDITABLE',
        'Berat kiriman ini sudah tidak dapat dikoreksi.',
      );
    }

    const previousChargeableWeight = shipment.chargeableWeight;
    const previousTotalAmount = shipment.totalAmount;

    // Selalu memakai snapshot milik kiriman — koreksi berat tidak boleh
    // diam-diam memakai tarif atau berat minimum yang berlaku sekarang (§7.5).
    const recalculated = calculateTariff({
      weightKg: dto.actualWeight,
      minChargeableWeight: shipment.minChargeableWeightSnapshot,
      pricePerKg: shipment.pricePerKgSnapshot,
      baseFee: shipment.baseFeeSnapshot,
    });

    const difference = recalculated.total - previousTotalAmount;
    // Kekurangan ditandai, tetapi pengiriman tetap boleh berjalan — keputusan
    // bisnis, bukan pemblokiran sistem. Kelebihan bayar tercatat lewat
    // `difference` dan audit log untuk ditindaklanjuti manual (§7.5).
    const outstandingAmount =
      shipment.paymentStatus === 'PAID'
        ? difference > 0n
          ? difference
          : 0n
        : recalculated.total;

    const noteParts = [
      `Berat dikoreksi menjadi ${dto.actualWeight} kg`,
      dto.notes,
    ].filter(Boolean);

    const updated = await this.repo.applyWeightCorrection(
      shipment.id,
      {
        actualWeight: dto.actualWeight,
        chargeableWeight: recalculated.chargeableWeight,
        totalAmount: recalculated.total,
        outstandingAmount,
      },
      { status: shipment.status, notes: noteParts.join(' — ') },
      (tx) =>
        this.audit.record(
          {
            action: 'SHIPMENT_WEIGHT_CORRECTED',
            actorId: adminId,
            entityType: 'shipment',
            entityId: shipment.id,
            entityLabel: shipment.trackingNumber,
            before: {
              chargeableWeight: previousChargeableWeight,
              totalAmount: Number(previousTotalAmount),
            },
            after: {
              actualWeight: dto.actualWeight,
              chargeableWeight: recalculated.chargeableWeight,
              totalAmount: Number(recalculated.total),
              ...(dto.notes ? { notes: dto.notes } : {}),
            },
          },
          tx,
        ),
    );

    return {
      shipment: toAdminShipmentDetail(updated),
      previousChargeableWeight,
      previousTotalAmount: Number(previousTotalAmount),
      difference: Number(difference),
    };
  }

  private async applyTransition(
    adminId: string,
    shipment: Shipment,
    next: ShipmentStatus,
    options: {
      location?: string;
      notes?: string;
      deliveredTo?: string;
      reason?: string;
    },
  ) {
    const previousStatus = nextPreviousStatus(shipment.status, next);
    const note = [options.reason, options.notes].filter(Boolean).join(' — ');

    return this.repo.applyStatusTransition(
      shipment.id,
      {
        status: next,
        ...(previousStatus !== undefined ? { previousStatus } : {}),
        ...(next === 'DELIVERED'
          ? { deliveredTo: options.deliveredTo ?? null }
          : {}),
        ...(next === 'CANCELLED'
          ? { cancelReason: options.reason ?? null }
          : {}),
      },
      {
        status: next,
        notes: note || undefined,
        location: options.location,
      },
      (tx) =>
        this.audit.record(
          {
            action: 'SHIPMENT_STATUS_CHANGED',
            actorId: adminId,
            entityType: 'shipment',
            entityId: shipment.id,
            entityLabel: shipment.trackingNumber,
            before: { status: shipment.status },
            after: { status: next },
          },
          tx,
        ),
    );
  }

  private async resolveOwner(
    adminId: string,
    onBehalfOfUserId?: string,
  ): Promise<User> {
    // Tanpa akun tujuan, kiriman tercatat sebagai walk-in atas nama admin.
    const owner = await this.authRepo.findUserById(onBehalfOfUserId ?? adminId);
    if (!owner) {
      throw new DomainException('NOT_FOUND', 'Akun customer tidak ditemukan.');
    }
    if (owner.status === 'SUSPENDED') {
      throw new DomainException(
        'AUTH_ACCOUNT_SUSPENDED',
        'Akun customer sedang ditangguhkan.',
      );
    }
    return owner;
  }

  private async findByIdOrThrow(id: string) {
    const shipment = await this.repo.findByIdForAdmin(id);
    if (!shipment) {
      throw new DomainException('NOT_FOUND', 'Kiriman tidak ditemukan.');
    }
    return shipment;
  }

  private async findByIdOrTrackingNumber(value: string) {
    const canonical = canonicalizeTrackingNumber(value);
    const shipment = canonical
      ? await this.repo.findByTrackingNumberForAdmin(canonical)
      : await this.repo.findByIdForAdmin(value);

    if (!shipment) {
      throw new DomainException('NOT_FOUND', 'Kiriman tidak ditemukan.');
    }
    return shipment;
  }
}

function endOfDay(value: string): Date {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}
