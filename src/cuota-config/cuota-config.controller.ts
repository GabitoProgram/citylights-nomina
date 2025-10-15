import { Controller, Get, Put, Post, Delete, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import { CuotaConfigService } from './cuota-config.service';
import { ActualizarCuotaDto } from './cuota-config.types';
import { CrearConceptoDto, ActualizarConceptoDto } from './dto/concepto.dto';

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

  // 📋 Obtener todos los conceptos disponibles
  @Get('conceptos')
  async obtenerConceptosDisponibles() {
    try {
      console.log('📋 Obteniendo conceptos disponibles...');
      const conceptos = await this.cuotaConfigService.obtenerConceptosDisponibles();
      
      return {
        success: true,
        data: conceptos,
        message: 'Conceptos obtenidos exitosamente'
      };
    } catch (error) {
      console.error('❌ Error al obtener conceptos:', error);
      throw new HttpException(
        'Error al obtener los conceptos disponibles',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ➕ Agregar nuevo concepto
  @Post('conceptos')
  async agregarConcepto(@Body() conceptoDto: CrearConceptoDto) {
    try {
      console.log('➕ Agregando nuevo concepto:', conceptoDto);
      const nuevoConcepto = await this.cuotaConfigService.agregarConcepto(conceptoDto);
      
      return {
        success: true,
        data: nuevoConcepto,
        message: `Concepto '${nuevoConcepto.label}' agregado exitosamente`
      };
    } catch (error) {
      console.error('❌ Error al agregar concepto:', error);
      
      if (error.status) {
        throw error;
      }
      
      throw new HttpException(
        'Error interno al agregar el concepto',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ✏️ Actualizar concepto existente
  @Put('conceptos/:key')
  async actualizarConcepto(
    @Param('key') key: string,
    @Body() conceptoDto: ActualizarConceptoDto
  ) {
    try {
      console.log(`✏️ Actualizando concepto '${key}':`, conceptoDto);
      const conceptoActualizado = await this.cuotaConfigService.actualizarConcepto(key, conceptoDto);
      
      return {
        success: true,
        data: conceptoActualizado,
        message: `Concepto '${key}' actualizado exitosamente`
      };
    } catch (error) {
      console.error('❌ Error al actualizar concepto:', error);
      
      if (error.status) {
        throw error;
      }
      
      throw new HttpException(
        'Error interno al actualizar el concepto',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // 🗑️ Eliminar concepto
  @Delete('conceptos/:key')
  async eliminarConcepto(@Param('key') key: string) {
    try {
      console.log(`🗑️ Eliminando concepto '${key}'...`);
      const resultado = await this.cuotaConfigService.eliminarConcepto(key);
      
      return {
        success: true,
        data: resultado,
        message: resultado.mensaje
      };
    } catch (error) {
      console.error('❌ Error al eliminar concepto:', error);
      
      if (error.status) {
        throw error;
      }
      
      throw new HttpException(
        'Error interno al eliminar el concepto',
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