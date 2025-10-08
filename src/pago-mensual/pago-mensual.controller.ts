import { Controller, Post, Get, Body, Headers, Query, Param } from '@nestjs/common';
import { PagoMensualService } from './pago-mensual.service';

@Controller('pago-mensual')
export class PagoMensualController {
  constructor(private readonly pagoMensualService: PagoMensualService) {}

  /**
   * 🏢 EMPLEADOS: Verificar si un empleado ya fue pagado este mes
   */
  @Get('empleado/:id/verificar')
  async verificarPagoEmpleado(
    @Param('id') trabajadorId: string,
    @Query('anio') anio?: string,
    @Query('mes') mes?: string
  ) {
    return this.pagoMensualService.verificarPagoMensualEmpleado(
      +trabajadorId,
      anio ? +anio : undefined,
      mes ? +mes : undefined
    );
  }

  /**
   * 🏢 EMPLEADOS: Crear pago mensual para empleado
   */
  @Post('empleado/pagar')
  async pagarEmpleado(
    @Body() body: { trabajadorId: number; monto: number },
    @Headers('x-user-id') userId: string,
    @Headers('x-user-name') userName: string,
    @Headers('x-user-role') userRole: string
  ) {
    const userContext = { userId, userName, userRole };
    return this.pagoMensualService.crearPagoMensualEmpleado(
      body.trabajadorId,
      body.monto,
      userContext
    );
  }

  /**
   * 🏠 RESIDENTES: Verificar cuota mensual de residente
   */
  @Get('residente/:userId/verificar')
  async verificarCuotaResidente(
    @Param('userId') userId: string,
    @Query('anio') anio?: string,
    @Query('mes') mes?: string
  ) {
    return this.pagoMensualService.verificarCuotaMensualResidente(
      userId,
      anio ? +anio : undefined,
      mes ? +mes : undefined
    );
  }

  /**
   * 🏠 RESIDENTES: Crear sesión de pago para cuota mensual
   */
  @Post('residente/cuota')
  async crearSesionPagoCuota(
    @Body() body: { userId: string; userName: string; userEmail: string }
  ) {
    return this.pagoMensualService.crearSesionPagoCuotaResidente(
      body.userId,
      body.userName,
      body.userEmail
    );
  }

  /**
   * Confirmar pago de cuota mensual (webhook)
   */
  @Post('residente/confirmar/:sessionId')
  async confirmarPagoCuota(@Param('sessionId') sessionId: string) {
    return this.pagoMensualService.confirmarPagoCuotaResidente(sessionId);
  }

  /**
   * 📊 REPORTES: Historial de pagos de empleados
   */
  @Get('empleados/historial')
  async obtenerHistorialEmpleados(
    @Query('anio') anio?: string,
    @Query('mes') mes?: string
  ) {
    return this.pagoMensualService.obtenerHistorialPagosEmpleados(
      anio ? +anio : undefined,
      mes ? +mes : undefined
    );
  }

  /**
   * 📊 REPORTES: Historial de cuotas de residentes
   */
  @Get('residentes/historial')
  async obtenerHistorialResidentes(
    @Query('anio') anio?: string,
    @Query('mes') mes?: string,
    @Query('estado') estado?: string
  ) {
    return this.pagoMensualService.obtenerHistorialCuotasResidentes(
      anio ? +anio : undefined,
      mes ? +mes : undefined,
      estado
    );
  }

  /**
   * 🔄 AUTOMÁTICO: Generar cuotas mensuales para todos los residentes
   */
  @Post('residentes/generar-cuotas')
  async generarCuotasAutomaticas(
    @Body() body: { 
      residentes: Array<{userId: string, userName: string, userEmail: string}> 
    }
  ) {
    return this.pagoMensualService.generarCuotasMensualesAutomaticas(body.residentes);
  }

  /**
   * 📈 ESTADÍSTICAS: Resumen del mes actual
   */
  @Get('estadisticas/mes-actual')
  async obtenerEstadisticasMesActual() {
    const fecha = new Date();
    const anio = fecha.getFullYear();
    const mes = fecha.getMonth() + 1;

    const [pagosEmpleados, cuotasResidentes] = await Promise.all([
      this.pagoMensualService.obtenerHistorialPagosEmpleados(anio, mes),
      this.pagoMensualService.obtenerHistorialCuotasResidentes(anio, mes)
    ]);

    return {
      mes,
      anio,
      empleados: {
        totalPagados: pagosEmpleados.length,
        montoTotal: pagosEmpleados.reduce((sum, pago) => sum + pago.monto, 0),
        pagos: pagosEmpleados
      },
      residentes: {
        totalCuotas: cuotasResidentes.length,
        cuotasPagadas: cuotasResidentes.filter(c => c.estado === 'PAGADO').length,
        cuotasPendientes: cuotasResidentes.filter(c => c.estado === 'PENDIENTE').length,
        cuotasVencidas: cuotasResidentes.filter(c => c.estado === 'VENCIDO').length,
        montoRecaudado: cuotasResidentes
          .filter(c => c.estado === 'PAGADO')
          .reduce((sum, cuota) => sum + cuota.monto, 0),
        montoPendiente: cuotasResidentes
          .filter(c => c.estado !== 'PAGADO')
          .reduce((sum, cuota) => sum + cuota.monto, 0),
        cuotas: cuotasResidentes
      }
    };
  }

  /**
   * 🚨 MOROSIDAD: Verificar y aplicar morosidad a cuotas vencidas
   */
  @Post('morosidad/verificar')
  async verificarMorosidad() {
    return this.pagoMensualService.verificarYAplicarMorosidad();
  }

  /**
   * 📊 MOROSIDAD: Obtener resumen de cuotas con morosidad
   */
  @Get('morosidad/resumen')
  async obtenerResumenMorosidad() {
    return this.pagoMensualService.obtenerResumenMorosidad();
  }
}