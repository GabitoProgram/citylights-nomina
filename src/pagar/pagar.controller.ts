import { Controller, Get, Post, Body, UseGuards, Req, Param } from '@nestjs/common';
import { PagarService } from './pagar.service';

@Controller('pagar')
export class PagarController {
  constructor(private readonly pagarService: PagarService) {}

  @Get()
  findAll() {
    return this.pagarService.findAll();
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    // Extraer datos de usuario desde headers del gateway (JWT) o body (para pruebas)
    const userData = {
      id: req.headers['x-user-id'] || body.user?.id || '1',
      nombre: req.headers['x-user-nombre'] || body.user?.nombre || 'Usuario Test',
      rol: req.headers['x-user-rol'] || body.user?.rol || 'admin'
    };
    
    // Remover user del body si existe (para evitar conflictos)
    const { user, ...data } = body;
    
    return this.pagarService.create(data, userData);
  }

  @Post('confirmar/:id')
  async confirmarPago(@Body() body: any) {
    return this.pagarService.confirmarPago(body.pagoId);
  }

  @Get('reporte-egresos')
  async generarReporteEgresos() {
    return this.pagarService.generarReporteEgresos();
  }

  @Get('reporte-egresos/:mes/:anio')
  async generarReporteMensual(@Param('mes') mes: string, @Param('anio') anio: string) {
    return this.pagarService.generarReporteMensual(parseInt(mes), parseInt(anio));
  }
}
