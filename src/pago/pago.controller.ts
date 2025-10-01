import { Controller, Post, Get, Put, Delete, Body, Param, Headers } from '@nestjs/common';
import { PagoService } from './pago.service';

@Controller('pago')
export class PagoController {
  constructor(private readonly pagoService: PagoService) {}

  @Post('stripe/session')
  async crearSesionPago(
    @Body() body: { trabajadorId: number; nominaId: number; monto: number },
    @Headers('x-user-id') userId: string,
    @Headers('x-user-name') userName: string,
    @Headers('x-user-role') userRole: string
  ) {
    const userContext = { userId, userName, userRole };
    return this.pagoService.crearSesionPagoNomina(
      body.trabajadorId,
      body.nominaId,
      body.monto,
      userContext
    );
  }

  @Post('confirmar/:id')
  async confirmarPago(
    @Param('id') id: string,
    @Body() body: { sessionId: string }
  ) {
    return this.pagoService.confirmarPago(+id, body.sessionId);
  }

  @Get()
  async obtenerPagos() {
    return this.pagoService.obtenerPagos();
  }

  @Get('debug/estados')
  async obtenerEstadosPagos() {
    const pagos = await this.pagoService.obtenerPagos();
    const estadisticas = {
      totalPagos: pagos.length,
      estadosPorCantidad: {},
      ejemplosPorEstado: {}
    };

    pagos.forEach((pago: any) => {
      const estado = pago.estado || 'SIN_ESTADO';
      if (!estadisticas.estadosPorCantidad[estado]) {
        estadisticas.estadosPorCantidad[estado] = 0;
        estadisticas.ejemplosPorEstado[estado] = {
          id: pago.id,
          monto: pago.monto,
          fecha: pago.fecha,
          trabajador: pago.nomina?.trabajador?.nombre || 'No disponible'
        };
      }
      estadisticas.estadosPorCantidad[estado]++;
    });

    console.log('🔍 [DEBUG PAGOS] Estadísticas:', estadisticas);
    return estadisticas;
  }

  @Get(':id')
  async obtenerPago(@Param('id') id: string) {
    return this.pagoService.obtenerPagoPorId(+id);
  }
}