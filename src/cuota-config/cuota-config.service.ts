import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConceptosCuota, ConfiguracionCuota, ConceptoMetadata } from './cuota-config.types';
import { CrearConceptoDto, ActualizarConceptoDto } from './dto/concepto.dto';

@Injectable()
export class CuotaConfigService {
  constructor(private prisma: PrismaService) {}

  // 📋 Obtener la configuración actual de la cuota con conceptos dinámicos
  async obtenerConfiguracion(): Promise<ConfiguracionCuota | null> {
    try {
      // Obtener metadata de conceptos desde la base de datos
      const conceptosMetadata = await this.prisma.conceptosMetadata.findMany({
        where: { activo: true },
        orderBy: { id: 'asc' }
      });

      // Si no hay conceptos en la BD, retornar configuración por defecto
      if (conceptosMetadata.length === 0) {
        return this.obtenerConfiguracionPorDefecto();
      }

      // Construir objeto de conceptos dinámicamente
      const conceptos: ConceptosCuota = {};
      let montoTotal = 0;

      for (const concepto of conceptosMetadata) {
        // Por defecto cada concepto vale $15, pero esto podría venir de otra tabla de configuración
        const valor = this.obtenerValorConcepto(concepto.key);
        conceptos[concepto.key] = valor;
        montoTotal += valor;
      }

      return {
        id: 1,
        conceptos,
        conceptosMetadata,
        montoTotal,
        fechaActualizacion: new Date()
      };
    } catch (error) {
      console.error('Error al obtener configuración de cuota:', error);
      return null;
    }
  }

  // 🎯 Obtener configuración por defecto si no hay conceptos en BD
  private obtenerConfiguracionPorDefecto(): ConfiguracionCuota {
    const conceptosDefault = {
      jardinFrente: 15.0,
      jardinGeneral: 20.0,
      recojoBasura: 25.0,
      limpieza: 30.0,
      luzGradas: 10.0,
      cera: 5.0,
      ace: 8.0,
      lavanderia: 12.0,
      ahorroAdministracion: 20.0,
      agua: 35.0
    };

    return {
      id: 1,
      conceptos: conceptosDefault,
      conceptosMetadata: [],
      montoTotal: 180.0,
      fechaActualizacion: new Date()
    };
  }

  // 💰 Obtener valor de un concepto específico (por ahora valores fijos, pero puede venir de configuración)
  private obtenerValorConcepto(key: string): number {
    const valoresPorDefecto: { [key: string]: number } = {
      jardinFrente: 15.0,
      jardinGeneral: 20.0,
      recojoBasura: 25.0,
      limpieza: 30.0,
      luzGradas: 10.0,
      cera: 5.0,
      ace: 8.0,
      lavanderia: 12.0,
      ahorroAdministracion: 20.0,
      agua: 35.0
    };

    return valoresPorDefecto[key] || 15.0; // Valor por defecto para conceptos nuevos
  }

  // 🔄 Actualizar la configuración de la cuota
  async actualizarConfiguracion(conceptos: ConceptosCuota): Promise<ConfiguracionCuota> {
    try {
      // Validar que los conceptos existen en la metadata
      const conceptosMetadata = await this.prisma.conceptosMetadata.findMany({
        where: { activo: true }
      });

      for (const key of Object.keys(conceptos)) {
        const existe = conceptosMetadata.some(cm => cm.key === key);
        if (!existe) {
          throw new BadRequestException(`El concepto '${key}' no existe o no está activo`);
        }
      }

      // Calcular el monto total
      const montoTotal = Object.values(conceptos).reduce((sum, value) => sum + (value || 0), 0);

      console.log('💰 Actualizando configuración de cuota mensual:');
      console.log('📋 Conceptos:', conceptos);
      console.log('💵 Monto total calculado:', montoTotal);

      // Actualizar todas las cuotas PENDIENTES con el nuevo monto
      const cuotasActualizadas = await this.prisma.cuotaMensualResidente.updateMany({
        where: {
          estado: 'PENDIENTE'
        },
        data: {
          monto: montoTotal,
          montoTotal: montoTotal
        }
      });

      console.log(`✅ Actualizadas ${cuotasActualizadas.count} cuotas pendientes con nuevo monto: $${montoTotal}`);

      // Retornar la nueva configuración
      return {
        id: 1,
        conceptos,
        conceptosMetadata,
        montoTotal,
        fechaActualizacion: new Date()
      };
    } catch (error) {
      console.error('❌ Error al actualizar configuración de cuota:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error('Error al actualizar la configuración de cuota mensual');
    }
  }

  // 📝 Obtener todos los conceptos disponibles
  async obtenerConceptosDisponibles(): Promise<ConceptoMetadata[]> {
    try {
      return await this.prisma.conceptosMetadata.findMany({
        orderBy: { id: 'asc' }
      });
    } catch (error) {
      console.error('Error al obtener conceptos disponibles:', error);
      throw new Error('Error al obtener la lista de conceptos');
    }
  }

  // ➕ Agregar nuevo concepto
  async agregarConcepto(conceptoDto: CrearConceptoDto): Promise<ConceptoMetadata> {
    try {
      // Verificar que no existe un concepto con la misma clave
      const existente = await this.prisma.conceptosMetadata.findUnique({
        where: { key: conceptoDto.key }
      });

      if (existente) {
        throw new BadRequestException(`Ya existe un concepto con la clave '${conceptoDto.key}'`);
      }

      // Crear el nuevo concepto
      const nuevoConcepto = await this.prisma.conceptosMetadata.create({
        data: {
          key: conceptoDto.key,
          label: conceptoDto.label,
          descripcion: conceptoDto.descripcion,
          activo: conceptoDto.activo ?? true
        }
      });

      console.log(`✅ Concepto '${nuevoConcepto.label}' agregado exitosamente con clave '${nuevoConcepto.key}'`);
      return nuevoConcepto;
    } catch (error) {
      console.error('❌ Error al agregar concepto:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error('Error al agregar el nuevo concepto');
    }
  }

  // ✏️ Actualizar concepto existente
  async actualizarConcepto(key: string, conceptoDto: ActualizarConceptoDto): Promise<ConceptoMetadata> {
    try {
      const conceptoExistente = await this.prisma.conceptosMetadata.findUnique({
        where: { key }
      });

      if (!conceptoExistente) {
        throw new NotFoundException(`No se encontró el concepto con clave '${key}'`);
      }

      const conceptoActualizado = await this.prisma.conceptosMetadata.update({
        where: { key },
        data: {
          ...(conceptoDto.label && { label: conceptoDto.label }),
          ...(conceptoDto.descripcion !== undefined && { descripcion: conceptoDto.descripcion }),
          ...(conceptoDto.activo !== undefined && { activo: conceptoDto.activo })
        }
      });

      console.log(`✅ Concepto '${key}' actualizado exitosamente`);
      return conceptoActualizado;
    } catch (error) {
      console.error('❌ Error al actualizar concepto:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error('Error al actualizar el concepto');
    }
  }

  // 🗑️ Eliminar concepto (marcar como inactivo)
  async eliminarConcepto(key: string): Promise<{ mensaje: string }> {
    try {
      const conceptoExistente = await this.prisma.conceptosMetadata.findUnique({
        where: { key }
      });

      if (!conceptoExistente) {
        throw new NotFoundException(`No se encontró el concepto con clave '${key}'`);
      }

      // Marcar como inactivo en lugar de eliminar físicamente
      await this.prisma.conceptosMetadata.update({
        where: { key },
        data: { activo: false }
      });

      console.log(`✅ Concepto '${key}' marcado como inactivo`);
      return { mensaje: `Concepto '${conceptoExistente.label}' eliminado exitosamente` };
    } catch (error) {
      console.error('❌ Error al eliminar concepto:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error('Error al eliminar el concepto');
    }
  }

  // 💵 Obtener el monto base actual para nuevas cuotas
  async obtenerMontoBase(): Promise<number> {
    try {
      const configuracion = await this.obtenerConfiguracion();
      return configuracion?.montoTotal || 100.0;
    } catch (error) {
      console.error('Error al obtener monto base:', error);
      return 100.0;
    }
  }
}