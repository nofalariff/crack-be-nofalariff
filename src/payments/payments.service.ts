import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fromBuffer } from 'file-type';
import { AuthRepository } from '../auth/auth.repository';
import { Paginated } from '../common/dto/pagination-meta';
import { DomainException } from '../common/exceptions/domain.exception';
import { canonicalizeTrackingNumber } from '../common/utils/tracking-number';
import {
  ShipmentDetailView,
  toShipmentDetail,
} from '../shipments/shipment.view';
import { ShipmentsRepository } from '../shipments/shipments.repository';
import { StorageService } from '../storage/storage.service';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { RejectPaymentDto } from './dto/reject-payment.dto';
import { UploadPaymentDto } from './dto/upload-payment.dto';
import {
  InvoiceView,
  PaymentQueueItemView,
  toPaymentView,
} from './payment.view';
import { PaymentForQueue, PaymentsRepository } from './payments.repository';

// Batas waktu bayar 3 × 24 jam hanya penanda di invoice — tidak pernah
// membatalkan kiriman secara otomatis (planbackend.md §7.4).
const PAYMENT_DUE_HOURS = 72;
const MIN_REJECTION_REASON_LENGTH = 10;
const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export interface UploadedProof {
  buffer: Buffer;
  originalname: string;
  size: number;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly repo: PaymentsRepository,
    private readonly shipmentsRepo: ShipmentsRepository,
    private readonly authRepo: AuthRepository,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  async invoiceFor(
    userId: string,
    trackingNumber: string,
  ): Promise<InvoiceView> {
    const canonical = canonicalizeTrackingNumber(trackingNumber);
    const shipment = canonical
      ? await this.shipmentsRepo.findByTrackingNumber(userId, canonical)
      : null;

    // 404, bukan 403 — keberadaan data milik orang lain tidak boleh terbaca.
    if (!shipment) {
      throw new DomainException('NOT_FOUND', 'Kiriman tidak ditemukan.');
    }

    const user = await this.authRepo.findUserById(userId);
    if (!user) throw new DomainException('UNAUTHORIZED');

    const pricePerKg = Number(shipment.pricePerKgSnapshot);

    return {
      trackingNumber: shipment.trackingNumber,
      issuedAt: shipment.createdAt,
      dueAt: new Date(
        shipment.createdAt.getTime() + PAYMENT_DUE_HOURS * 60 * 60 * 1000,
      ),
      customerName: user.fullName,
      customerEmail: user.email,
      serviceType: shipment.serviceType,
      destinationName: shipment.destinationName,
      chargeableWeight: shipment.chargeableWeight,
      pricePerKg,
      weightFee: shipment.chargeableWeight * pricePerKg,
      baseFee: Number(shipment.baseFeeSnapshot),
      totalAmount: Number(shipment.totalAmount),
      outstandingAmount: Number(shipment.outstandingAmount),
      paymentStatus: shipment.paymentStatus,
      bankAccount: {
        bankName: this.config.getOrThrow<string>('BANK_NAME'),
        accountNumber: this.config.getOrThrow<string>('BANK_ACCOUNT_NUMBER'),
        accountHolder: this.config.getOrThrow<string>('BANK_ACCOUNT_HOLDER'),
      },
      payments: shipment.payments.map((payment) => toPaymentView(payment)),
    };
  }

  async uploadProof(
    userId: string,
    shipmentId: string,
    dto: UploadPaymentDto,
    proof: UploadedProof | undefined,
  ): Promise<ShipmentDetailView> {
    const shipment = await this.shipmentsRepo.findByIdForUser(
      userId,
      shipmentId,
    );
    if (!shipment) {
      throw new DomainException('NOT_FOUND', 'Kiriman tidak ditemukan.');
    }
    if (shipment.paymentStatus === 'PAID') {
      throw new DomainException(
        'PAYMENT_ALREADY_VERIFIED',
        'Pembayaran untuk kiriman ini sudah diverifikasi.',
      );
    }
    if (shipment.status === 'CANCELLED') {
      throw new DomainException(
        'SHIPMENT_NOT_EDITABLE',
        'Kiriman ini sudah dibatalkan.',
      );
    }

    const { file, mimeType } = await this.assertAcceptableProof(proof);

    const stored = await this.storage.save(file.buffer, {
      originalName: file.originalname,
      folder: 'payment-proofs',
    });

    await this.repo.createWithAttachment({
      shipmentId: shipment.id,
      claimedAmount: BigInt(dto.claimedAmount),
      senderAccountName: dto.senderAccountName,
      transferDate: new Date(dto.transferDate),
      attachment: {
        storageKey: stored.storageKey,
        originalName: file.originalname,
        mimeType,
        sizeBytes: stored.sizeBytes,
        uploadedById: userId,
      },
    });

    return this.reloadDetail(userId, shipment.id);
  }

  async queue(
    query: ListPaymentsQueryDto,
  ): Promise<Paginated<PaymentQueueItemView>> {
    const status = query.status ?? 'WAITING_VERIFICATION';
    const [rows, total] = await this.repo.findQueue(
      status === 'ALL' ? undefined : status,
      { page: query.page, limit: query.limit },
    );

    return {
      data: rows.map((row) => this.toQueueItem(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async verify(paymentId: string): Promise<ShipmentDetailView> {
    const payment = await this.getPaymentOrThrow(paymentId);

    // Idempoten: menyetujui ulang ditolak, bukan menggandakan event (§7.4).
    if (payment.status === 'VERIFIED') {
      throw new DomainException(
        'PAYMENT_ALREADY_VERIFIED',
        'Pembayaran untuk kiriman ini sudah diverifikasi.',
      );
    }

    // Hanya boleh ada satu record VERIFIED per kiriman (§7.4).
    const alreadyVerified = await this.repo.countVerifiedForShipment(
      payment.shipmentId,
      payment.id,
    );
    if (alreadyVerified > 0) {
      throw new DomainException(
        'PAYMENT_ALREADY_VERIFIED',
        'Pembayaran untuk kiriman ini sudah diverifikasi.',
      );
    }

    await this.repo.verify({
      paymentId: payment.id,
      shipmentId: payment.shipmentId,
      appendPaidEvent: payment.shipment.status === 'PENDING_PAYMENT',
    });

    return this.reloadDetail(payment.shipment.userId, payment.shipmentId);
  }

  async reject(
    paymentId: string,
    dto: RejectPaymentDto,
  ): Promise<ShipmentDetailView> {
    const payment = await this.getPaymentOrThrow(paymentId);

    // Alasan divalidasi lebih dulu agar pesannya sama persis dengan mock,
    // termasuk saat pembayaran sudah terverifikasi.
    const reason = dto.reason?.trim() ?? '';
    if (reason.length < MIN_REJECTION_REASON_LENGTH) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Alasan penolakan minimal 10 karakter.',
        [{ field: 'reason', message: 'Alasan penolakan minimal 10 karakter.' }],
      );
    }

    if (payment.status === 'VERIFIED') {
      throw new DomainException(
        'PAYMENT_ALREADY_VERIFIED',
        'Pembayaran ini sudah diverifikasi dan tidak dapat ditolak.',
      );
    }

    await this.repo.reject({
      paymentId: payment.id,
      shipmentId: payment.shipmentId,
      reason,
    });

    return this.reloadDetail(payment.shipment.userId, payment.shipmentId);
  }

  private async getPaymentOrThrow(id: string): Promise<PaymentForQueue> {
    const payment = await this.repo.findById(id);
    if (!payment) {
      throw new DomainException(
        'NOT_FOUND',
        'Data pembayaran tidak ditemukan.',
      );
    }
    return payment;
  }

  private async reloadDetail(
    userId: string,
    shipmentId: string,
  ): Promise<ShipmentDetailView> {
    const shipment = await this.shipmentsRepo.findByIdForUser(
      userId,
      shipmentId,
    );
    if (!shipment) {
      throw new DomainException('NOT_FOUND', 'Kiriman tidak ditemukan.');
    }
    return toShipmentDetail(shipment);
  }

  // Tipe berkas diverifikasi lewat magic number, bukan ekstensi atau
  // Content-Type yang dikirim klien (§8.3).
  private async assertAcceptableProof(
    proof: UploadedProof | undefined,
  ): Promise<{ file: UploadedProof; mimeType: string }> {
    if (!proof || proof.size === 0) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Bukti transfer wajib diunggah.',
        [{ field: 'proof', message: 'Bukti transfer wajib diunggah.' }],
      );
    }

    const maxBytes =
      this.config.getOrThrow<number>('MAX_UPLOAD_SIZE_MB') * 1024 * 1024;
    if (proof.size > maxBytes) {
      throw new DomainException(
        'FILE_TOO_LARGE',
        'Ukuran berkas melebihi 5 MB.',
      );
    }

    const detected = await fromBuffer(proof.buffer);
    if (!detected || !ACCEPTED_MIME_TYPES.includes(detected.mime)) {
      throw new DomainException(
        'FILE_TYPE_NOT_ALLOWED',
        'Format berkas tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF.',
      );
    }

    return { file: proof, mimeType: detected.mime };
  }

  private toQueueItem(payment: PaymentForQueue): PaymentQueueItemView {
    const { shipment } = payment;
    const claimedAmount = Number(payment.claimedAmount);
    const totalAmount = Number(shipment.totalAmount);

    return {
      paymentId: payment.id,
      shipmentId: shipment.id,
      trackingNumber: shipment.trackingNumber,
      customerName: shipment.user.fullName,
      customerEmail: shipment.user.email,
      totalAmount,
      claimedAmount,
      difference: claimedAmount - totalAmount,
      senderAccountName: payment.senderAccountName,
      transferDate: payment.transferDate,
      attachmentId: payment.attachmentId,
      attachmentName: payment.attachment.originalName,
      status: payment.status,
      submittedAt: payment.createdAt,
    };
  }
}
