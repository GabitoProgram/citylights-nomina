import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class NominaService {
  private prisma = new PrismaClient();

  async findAll() {
    return this.prisma.nomina.findMany({ include: { trabajador: true, pagos: true } });
  }

  async create(data: any) {
    return this.prisma.nomina.create({ data });
  }
}
