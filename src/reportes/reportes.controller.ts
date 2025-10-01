import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReportesService } from './reportes.service';

@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  // Nuevo endpoint para obtener solo los datos JSON
  @Get('datos')
  async obtenerDatosReporte(
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string
  ) {
    try {
      console.log('📊 [ReportesController] Obteniendo datos para frontend...');
      const datos = await this.reportesService.obtenerDatosCompletos(fechaInicio, fechaFin);
      
      return {
        success: true,
        data: datos
      };
    } catch (error) {
      console.error('❌ [ReportesController] Error obteniendo datos:', error);
      return {
        success: false,
        message: 'Error obteniendo datos del reporte',
        error: error.message
      };
    }
  }

  @Get('pdf')
  async generarReportePDF(
    @Res() res: Response,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string
  ) {
    try {
      const pdf = await this.reportesService.generarReportePDF(fechaInicio, fechaFin);
      
      const filename = `reporte-financiero-${new Date().toISOString().split('T')[0]}.pdf`;
      
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdf.length.toString(),
        'Cache-Control': 'no-cache',
      });
      
      res.end(pdf);
    } catch (error) {
      console.error('Error generando reporte PDF:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al generar el reporte PDF',
        error: error.message 
      });
    }
  }

  @Get('excel')
  async generarReporteExcel(
    @Res() res: Response,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string
  ) {
    try {
      const excel = await this.reportesService.generarReporteExcel(fechaInicio, fechaFin);
      
      const filename = `reporte-financiero-${new Date().toISOString().split('T')[0]}.xlsx`;
      
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': excel.length.toString(),
        'Cache-Control': 'no-cache',
      });
      
      res.end(excel);
    } catch (error) {
      console.error('Error generando reporte Excel:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al generar el reporte Excel',
        error: error.message 
      });
    }
  }
}