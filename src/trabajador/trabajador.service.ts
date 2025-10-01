import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class TrabajadorService {
  private prisma = new PrismaClient();

  async findAll() {
    return this.prisma.trabajador.findMany({
      include: {
        nominas: {
          include: {
            pagos: true
          }
        }
      }
    });
  }

  async findOne(id: number) {
    return this.prisma.trabajador.findUnique({
      where: { id },
      include: {
        nominas: {
          include: {
            pagos: true
          }
        }
      }
    });
  }

  async create(data: any) {
    // Solo usar los campos que existen en el schema de Prisma
    const trabajadorData = {
      nombre: data.nombre,
      sueldo: data.sueldo,
      tipo: data.tipo
    };
    
    return this.prisma.trabajador.create({ 
      data: trabajadorData 
    });
  }

  async update(id: number, data: any) {
    // Solo usar los campos que existen en el schema de Prisma
    const trabajadorData = {
      nombre: data.nombre,
      sueldo: data.sueldo,
      tipo: data.tipo
    };

    return this.prisma.trabajador.update({
      where: { id },
      data: trabajadorData
    });
  }

  async remove(id: number) {
    // Verificar si el trabajador tiene nóminas asociadas
    const trabajadorConNominas = await this.prisma.trabajador.findUnique({
      where: { id },
      include: { nominas: true }
    });

    if (trabajadorConNominas && trabajadorConNominas.nominas.length > 0) {
      throw new Error('No se puede eliminar el trabajador porque tiene nóminas asociadas');
    }

    return this.prisma.trabajador.delete({
      where: { id }
    });
  }
}
