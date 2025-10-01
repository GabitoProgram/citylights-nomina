import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { FacturaNominaService } from './factura-nomina.service';
import * as fs from 'fs';

@Controller('factura')
export class FacturaNominaController {
  constructor(private readonly facturaNominaService: FacturaNominaService) {}

  @Get('generar/:pagoId')
  async generarFactura(@Param('pagoId') pagoId: string) {
    return this.facturaNominaService.generarFacturaAutomatica(+pagoId);
  }

  @Get('pdf/:pagoId')
  async descargarFacturaPDF(
    @Param('pagoId') pagoId: string,
    @Res() res: Response
  ) {
    try {
      const filePath = await this.facturaNominaService.obtenerRutaFacturaPorPago(+pagoId);
      
      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Factura no encontrada' });
      }
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="factura_nomina_${pagoId}.pdf"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  @Get()
  async obtenerFacturas() {
    return this.facturaNominaService.obtenerFacturas();
  }
}