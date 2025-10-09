import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PagoMensualService } from '../pago-mensual/pago-mensual.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private pagoMensualService: PagoMensualService) {}

  /**
   * 🤖 Generar cuotas automáticamente el primer día de cada mes a las 9:00 AM
   */
  @Cron('0 9 1 * *') // Día 1 de cada mes a las 9:00 AM
  async generarCuotasMensuales() {
    this.logger.log('🤖 Iniciando generación automática de cuotas mensuales...');
    
    try {
      const resultado = await this.pagoMensualService.generarCuotasMensualesAutomaticas();
      this.logger.log(`✅ Cuotas generadas: ${JSON.stringify(resultado)}`);
    } catch (error) {
      this.logger.error(`❌ Error generando cuotas automáticas: ${error.message}`);
    }
  }

  /**
   * 📊 Verificar morosidad diariamente a las 6:00 AM
   */
  @Cron('0 6 * * *') // Todos los días a las 6:00 AM
  async verificarMorosidadDiaria() {
    this.logger.log('📊 Verificando morosidad diaria...');
    
    try {
      await this.pagoMensualService.verificarYAplicarMorosidad();
      this.logger.log('✅ Verificación de morosidad completada');
    } catch (error) {
      this.logger.error(`❌ Error verificando morosidad: ${error.message}`);
    }
  }

  /**
   * 🔄 Método manual para generar cuotas (para testing)
   */
  async generarCuotasManuales() {
    this.logger.log('🔄 Generación manual de cuotas iniciada...');
    
    try {
      const resultado = await this.pagoMensualService.generarCuotasMensualesAutomaticas();
      this.logger.log(`✅ Cuotas generadas manualmente: ${JSON.stringify(resultado)}`);
      return resultado;
    } catch (error) {
      this.logger.error(`❌ Error en generación manual: ${error.message}`);
      throw error;
    }
  }
}