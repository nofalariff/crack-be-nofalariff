import type { Readable } from 'node:stream';
import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { DomainException } from '../common/exceptions/domain.exception';
import { PaymentsRepository } from '../payments/payments.repository';
import { StorageService } from '../storage/storage.service';

export interface ServedFile {
  stream: Readable;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly paymentsRepo: PaymentsRepository,
    private readonly storage: StorageService,
  ) {}

  async serve(
    attachmentId: string,
    viewer: { id: string; role: UserRole },
  ): Promise<ServedFile> {
    const attachment = await this.paymentsRepo.findAttachmentById(attachmentId);
    if (!attachment) {
      throw new DomainException('NOT_FOUND', 'Berkas tidak ditemukan.');
    }

    // Berkas hanya boleh diambil pemiliknya atau admin (NFR-SEC-07).
    const ownerId =
      attachment.payment?.shipment.userId ?? attachment.uploadedById;
    if (viewer.role !== 'ADMIN' && ownerId !== viewer.id) {
      throw new DomainException(
        'FORBIDDEN',
        'Anda tidak memiliki akses ke berkas ini.',
      );
    }

    return {
      stream: await this.storage.openReadStream(attachment.storageKey),
      mimeType: attachment.mimeType,
      originalName: attachment.originalName,
      sizeBytes: attachment.sizeBytes,
    };
  }
}
