import { Controller, Get, Param, Res, Post, Body } from '@nestjs/common';
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

  // 🆕 ENDPOINT PARA GENERAR PDF DE CUOTAS DE RESIDENTES
  @Post('cuota/generar-pdf')
  async generarPDFCuotaResidente(
    @Body() datos: {
      numeroFactura: string;
      clienteNombre: string;
      clienteEmail: string;
      total: number;
      concepto: string;
      periodo: string;
      cuotaId: number;
      detalles?: Array<{
        descripcion: string;
        cantidad: number;
        precio: number;
        total: number;
      }>;
    },
    @Res() res: Response
  ) {
    try {
      const pdfBuffer = await this.facturaNominaService.generarPDFCuotaResidente(datos);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="factura_cuota_${datos.numeroFactura}.pdf"`);
      res.send(pdfBuffer);
      
    } catch (error) {
      console.error('❌ Error en endpoint generar-pdf:', error);
      console.error('❌ Stack trace:', error.stack);
      res.status(500).json({ 
        success: false,
        error: error.message,
        details: error.stack
      });
    }
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