import { Controller, Get, Put, Body, HttpException, HttpStatus } from '@nestjs/common';
import { CuotaConfigService } from './cuota-config.service';
import { ActualizarCuotaDto } from './cuota-config.types';

@Controller('cuota-config')
export class CuotaConfigController {
  constructor(private readonly cuotaConfigService: CuotaConfigService) {}

  @Get()
  async obtenerConfiguracion() {
    try {
      console.log('📋 Obteniendo configuración de cuota mensual...');
      const configuracion = await this.cuotaConfigService.obtenerConfiguracion();
      
      if (!configuracion) {
        throw new HttpException('Configuración no encontrada', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: configuracion,
        message: 'Configuración obtenida exitosamente'
      };
    } catch (error) {
      console.error('❌ Error al obtener configuración:', error);
      throw new HttpException(
        'Error al obtener la configuración de cuota',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put()
  async actualizarConfiguracion(@Body() actualizarCuotaDto: ActualizarCuotaDto) {
    try {
      console.log('🔄 Actualizando configuración de cuota mensual...');
      console.log('📝 Datos recibidos:', actualizarCuotaDto);

      // Validar que todos los valores sean números positivos
      const conceptos = Object.values(actualizarCuotaDto);
      if (conceptos.some(valor => typeof valor !== 'number' || valor < 0)) {
        throw new HttpException(
          'Todos los valores deben ser números positivos',
          HttpStatus.BAD_REQUEST
        );
      }

      const configuracionActualizada = await this.cuotaConfigService.actualizarConfiguracion(actualizarCuotaDto);

      return {
        success: true,
        data: configuracionActualizada,
        message: `Configuración actualizada exitosamente. Nuevo monto total: $${configuracionActualizada.montoTotal}`
      };
    } catch (error) {
      console.error('❌ Error al actualizar configuración:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Error interno al actualizar la configuración',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('monto-base')
  async obtenerMontoBase() {
    try {
      console.log('💰 Obteniendo monto base actual...');
      const montoBase = await this.cuotaConfigService.obtenerMontoBase();
      
      return {
        success: true,
        data: { montoBase },
        message: 'Monto base obtenido exitosamente'
      };
    } catch (error) {
      console.error('❌ Error al obtener monto base:', error);
      throw new HttpException(
        'Error al obtener el monto base',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}