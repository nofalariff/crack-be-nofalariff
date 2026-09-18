import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogData {
  action: AuditAction;
  actorId: string;
  actorName: string;
  actorEmail: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Menerima client transaksi agar pencatatan audit ikut batal bila aksinya
  // gagal di tengah jalan (§4.3).
  create(data: AuditLogData, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).auditLog.create({ data });
  }

  findMany(
    filters: { action?: AuditAction; dateFrom?: Date; dateTo?: Date },
    pagination: { page: number; limit: number },
  ) {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.action) where.action = filters.action;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {
        ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
        ...(filters.dateTo ? { lte: filters.dateTo } : {}),
      };
    }

    return this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        // id sebagai pemecah seri: aksi massal menulis banyak baris dalam
        // milidetik yang sama.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
  }
}
