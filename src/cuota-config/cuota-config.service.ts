import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConceptosCuota, ConfiguracionCuota } from './cuota-config.types';

@Injectable()
export class CuotaConfigService {
  constructor(private prisma: PrismaService) {}

  // Obtener la configuración actual de la cuota
  async obtenerConfiguracion(): Promise<ConfiguracionCuota | null> {
    try {
      // Por ahora simulamos la configuración, pero puedes crear una tabla específica si necesitas
      // Aquí obtenemos el monto base de la primera cuota encontrada o usamos valores por defecto
      const primeraConfiguracion = {
        id: 1,
        conceptos: {
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
        },
        montoTotal: 180.0,
        fechaActualizacion: new Date()
      };

      return primeraConfiguracion;
    } catch (error) {
      console.error('Error al obtener configuración de cuota:', error);
      return null;
    }
  }

  // Actualizar la configuración de la cuota
  async actualizarConfiguracion(conceptos: ConceptosCuota): Promise<ConfiguracionCuota> {
    try {
      // Calcular el monto total
      const montoTotal = Object.values(conceptos).reduce((sum, value) => sum + value, 0);

      console.log('💰 Actualizando configuración de cuota mensual:');
      console.log('📋 Conceptos:', conceptos);
      console.log('💵 Monto total calculado:', montoTotal);

      // Actualizar todas las cuotas PENDIENTES con el nuevo monto
      const cuotasActualizadas = await this.prisma.cuotaMensualResidente.updateMany({
        where: {
          estado: 'PENDIENTE' // Solo actualizar cuotas pendientes
        },
        data: {
          monto: montoTotal,
          montoTotal: montoTotal // También actualizar el monto total
        }
      });

      console.log(`✅ Actualizadas ${cuotasActualizadas.count} cuotas pendientes con nuevo monto: $${montoTotal}`);

      // Retornar la nueva configuración
      const nuevaConfiguracion: ConfiguracionCuota = {
        id: 1,
        conceptos,
        montoTotal,
        fechaActualizacion: new Date()
      };

      return nuevaConfiguracion;
    } catch (error) {
      console.error('❌ Error al actualizar configuración de cuota:', error);
      throw new Error('Error al actualizar la configuración de cuota mensual');
    }
  }

  // Obtener el monto base actual para nuevas cuotas
  async obtenerMontoBase(): Promise<number> {
    try {
      const configuracion = await this.obtenerConfiguracion();
      return configuracion?.montoTotal || 100.0; // Valor por defecto
    } catch (error) {
      console.error('Error al obtener monto base:', error);
      return 100.0; // Valor por defecto en caso de error
    }
  }
}