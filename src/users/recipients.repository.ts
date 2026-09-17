import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RecipientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyByUser(userId: string) {
    return this.prisma.recipient.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOwned(userId: string, id: string) {
    return this.prisma.recipient.findFirst({ where: { id, userId } });
  }

  create(data: Prisma.RecipientUncheckedCreateInput) {
    return this.prisma.recipient.create({ data });
  }

  update(id: string, data: Prisma.RecipientUpdateInput) {
    return this.prisma.recipient.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.recipient.delete({ where: { id } });
  }
}
