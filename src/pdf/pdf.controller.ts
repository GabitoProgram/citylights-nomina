import { Controller, Get, Param, Res, Query } from '@nestjs/common';
import { Response } from 'express';
import { PdfService } from './pdf.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller('pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Get('comprobante/:pagoId')
  async generarComprobante(
    @Param('pagoId') pagoId: string,
    @Res() res: Response
  ) {
    try {
      console.log('🔍 [PDF] Solicitud de comprobante PDF para pagoId:', pagoId);
      console.log('🔍 [PDF] Tipo de pagoId:', typeof pagoId);
      console.log('🔍 [PDF] pagoId convertido a número:', +pagoId);
      
      const filePath = await this.pdfService.generarComprobantePago(+pagoId);
      console.log('✅ [PDF] PDF generado exitosamente:', filePath);
      
      // Verificar que el archivo existe
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ 
          error: 'Archivo PDF no encontrado después de la generación',
          filePath 
        });
      }

      // Obtener información del archivo
      const stats = fs.statSync(filePath);
      const nombreArchivo = path.basename(filePath);
      
      console.log(`📊 [PDF] Tamaño del archivo: ${stats.size} bytes`);
      console.log(`📄 [PDF] Nombre del archivo: ${nombreArchivo}`);
      
      // Configurar headers como en booking-service
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
      
      // Usar sendFile como en booking-service - esto funciona mejor con el gateway
      return res.sendFile(filePath, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${nombreArchivo}"`
        }
      });
      
    } catch (error) {
      console.error('❌ [PDF] Error generando comprobante:', error.message);
      console.error('❌ [PDF] Stack trace:', error.stack);
      res.status(500).json({ error: error.message });
    }
  }

  @Get('reporte')
  async generarReporte(
    @Query('mes') mes: string,
    @Query('año') año: string,
    @Res() res: Response
  ) {
    try {
      const filePath = await this.pdfService.generarReporteMensual(+mes, +año);
      
      // Verificar que el archivo existe
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ 
          error: 'Archivo PDF no encontrado después de la generación',
          filePath 
        });
      }

      const nombreArchivo = path.basename(filePath);
      
      // Usar sendFile como en booking-service
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
      
      return res.sendFile(filePath, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${nombreArchivo}"`
        }
      });
      
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}