import { Injectable } from '@nestjs/common';
import { AuditAction, AuditLog, Prisma } from '@prisma/client';
import { AuthRepository } from '../auth/auth.repository';
import { Paginated } from '../common/dto/pagination-meta';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { AuditRepository } from './audit.repository';

export interface RecordAuditInput {
  action: AuditAction;
  actorId: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}

export interface AuditLogView {
  id: string;
  action: AuditAction;
  actorName: string;
  actorEmail: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  before: Prisma.JsonValue | null;
  after: Prisma.JsonValue | null;
  createdAt: Date;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly repo: AuditRepository,
    private readonly authRepo: AuthRepository,
  ) {}

  // Nama dan email pelaku disalin ke baris audit supaya riwayat tetap terbaca
  // meski akunnya berganti nama atau dihapus di kemudian hari.
  async record(
    input: RecordAuditInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const actor = await this.authRepo.findUserById(input.actorId, tx);

    await this.repo.create(
      {
        action: input.action,
        actorId: input.actorId,
        actorName: actor?.fullName ?? '-',
        actorEmail: actor?.email ?? '-',
        entityType: input.entityType,
        entityId: input.entityId,
        entityLabel: input.entityLabel,
        before: input.before,
        after: input.after,
      },
      tx,
    );
  }

  async list(query: ListAuditLogsQueryDto): Promise<Paginated<AuditLogView>> {
    const [rows, total] = await this.repo.findMany(
      {
        action: query.action,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? endOfDay(query.dateTo) : undefined,
      },
      { page: query.page, limit: query.limit },
    );

    return {
      data: rows.map((row) => this.toView(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  // actorId tidak ikut keluar — riwayat cukup menampilkan nama dan email.
  private toView(log: AuditLog): AuditLogView {
    return {
      id: log.id,
      action: log.action,
      actorName: log.actorName,
      actorEmail: log.actorEmail,
      entityType: log.entityType,
      entityId: log.entityId,
      entityLabel: log.entityLabel,
      before: log.before,
      after: log.after,
      createdAt: log.createdAt,
    };
  }
}

function endOfDay(value: string): Date {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}
