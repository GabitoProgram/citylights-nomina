import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConceptosCuota, ConfiguracionCuota, CONCEPTOS_PREDEFINIDOS, ConceptoMetadata } from './cuota-config.types';

@Injectable()
export class CuotaConfigService {
  constructor(private prisma: PrismaService) {}

  // 🆕 Obtener conceptos disponibles (predefinidos + personalizados)
  async obtenerConceptosDisponibles(): Promise<ConceptoMetadata[]> {
    try {
      // Por ahora retornamos solo los predefinidos, pero puedes extender esto
      // para incluir conceptos personalizados almacenados en la base de datos
      return CONCEPTOS_PREDEFINIDOS;
    } catch (error) {
      console.error('Error al obtener conceptos disponibles:', error);
      return CONCEPTOS_PREDEFINIDOS;
    }
  }

  // 🆕 Agregar un nuevo concepto personalizado
  async agregarConceptoPersonalizado(nuevoConcepto: Omit<ConceptoMetadata, 'orden'>): Promise<ConceptoMetadata> {
    try {
      // Calcular el siguiente orden
      const conceptosExistentes = await this.obtenerConceptosDisponibles();
      const siguienteOrden = Math.max(...conceptosExistentes.map(c => c.orden)) + 1;

      const conceptoCompleto: ConceptoMetadata = {
        ...nuevoConcepto,
        orden: siguienteOrden
      };

      // Aquí podrías guardar en la base de datos si implementas persistencia
      console.log('🆕 Nuevo concepto agregado:', conceptoCompleto);
      
      return conceptoCompleto;
    } catch (error) {
      console.error('Error al agregar concepto personalizado:', error);
      throw error;
    }
  }

  // Obtener la configuración actual de la cuota (MEJORADO)
  async obtenerConfiguracion(): Promise<ConfiguracionCuota | null> {
    try {
      // Obtener conceptos disponibles
      const conceptosDisponibles = await this.obtenerConceptosDisponibles();
      
      // Crear configuración con todos los conceptos disponibles
      const conceptos: ConceptosCuota = {};
      
      // Inicializar conceptos predefinidos
      conceptosDisponibles.forEach(concepto => {
        if (concepto.activo) {
          conceptos[concepto.key] = this.obtenerValorPorDefecto(concepto.key);
        }
      });

      const configuracion = {
        id: 1,
        conceptos,
        montoTotal: Object.values(conceptos).reduce((sum, value) => sum + (value || 0), 0),
        fechaActualizacion: new Date()
      };

      return configuracion;
    } catch (error) {
      console.error('Error al obtener configuración de cuota:', error);
      return null;
    }
  }

  // 🆕 Obtener valor por defecto para un concepto
  private obtenerValorPorDefecto(key: string): number {
    const valoresPorDefecto: Record<string, number> = {
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
    
    return valoresPorDefecto[key] || 0.0;
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