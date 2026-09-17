import { Injectable } from '@nestjs/common';
import { Recipient } from '@prisma/client';
import { DomainException } from '../common/exceptions/domain.exception';
import { CreateRecipientDto } from './dto/create-recipient.dto';
import { UpdateRecipientDto } from './dto/update-recipient.dto';
import { RecipientsRepository } from './recipients.repository';

export interface RecipientView {
  id: string;
  label: string | null;
  name: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string | null;
  createdAt: Date;
}

@Injectable()
export class RecipientsService {
  constructor(private readonly repo: RecipientsRepository) {}

  async list(userId: string): Promise<RecipientView[]> {
    const rows = await this.repo.findManyByUser(userId);
    return rows.map((row) => this.toView(row));
  }

  async create(
    userId: string,
    dto: CreateRecipientDto,
  ): Promise<RecipientView> {
    const created = await this.repo.create({
      userId,
      label: dto.label ?? null,
      name: dto.name,
      phone: dto.phone,
      address: dto.address,
      city: dto.city,
      postalCode: dto.postalCode ?? null,
    });
    return this.toView(created);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateRecipientDto,
  ): Promise<RecipientView> {
    await this.getOwnedOrThrow(userId, id);

    const data: {
      label?: string | null;
      name?: string;
      phone?: string;
      address?: string;
      city?: string;
      postalCode?: string | null;
    } = {};

    if (dto.label !== undefined) data.label = dto.label || null;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.postalCode !== undefined) data.postalCode = dto.postalCode || null;

    const updated = await this.repo.update(id, data);
    return this.toView(updated);
  }

  // Penghapusan tidak pernah memengaruhi kiriman: data penerima disalin saat
  // booking, bukan direferensikan (§5.3.1).
  async remove(userId: string, id: string): Promise<null> {
    await this.getOwnedOrThrow(userId, id);
    await this.repo.delete(id);
    return null;
  }

  private async getOwnedOrThrow(
    userId: string,
    id: string,
  ): Promise<Recipient> {
    const recipient = await this.repo.findOwned(userId, id);
    if (!recipient) {
      throw new DomainException('NOT_FOUND', 'Penerima tidak ditemukan.');
    }
    return recipient;
  }

  private toView(recipient: Recipient): RecipientView {
    return {
      id: recipient.id,
      label: recipient.label,
      name: recipient.name,
      phone: recipient.phone,
      address: recipient.address,
      city: recipient.city,
      postalCode: recipient.postalCode,
      createdAt: recipient.createdAt,
    };
  }
}
