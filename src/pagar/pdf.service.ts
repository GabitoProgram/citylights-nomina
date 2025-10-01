import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  generarEgresoPDF(pago: any, trabajador: any): string {
    try {
      const doc = new PDFDocument();
      const fileName = `egreso_${pago.id}_${Date.now()}.pdf`;
      const egresoDir = path.join(process.cwd(), 'egresos');
      
      // Crear directorio si no existe
      if (!fs.existsSync(egresoDir)) {
        fs.mkdirSync(egresoDir, { recursive: true });
      }
      
      const filePath = path.join(egresoDir, fileName);
      doc.pipe(fs.createWriteStream(filePath));

      // Encabezado
      doc.fontSize(20).text('COMPROBANTE DE EGRESO', { align: 'center' });
      doc.fontSize(12).text('Sistema de Nómina', { align: 'center' });
      doc.moveDown(2);

      // Información del pago
      doc.fontSize(14).text('DATOS DEL PAGO', { underline: true });
      doc.moveDown();
      doc.fontSize(12)
         .text(`ID Pago: ${pago.id}`)
         .text(`Empleado: ${trabajador.nombre}`)
         .text(`Tipo de Empleado: ${trabajador.tipo}`)
         .text(`Sueldo Base: $${trabajador.sueldo}`)
         .text(`Monto Pagado: $${pago.monto}`)
         .text(`Fecha de Pago: ${new Date(pago.fecha).toLocaleDateString('es-ES')}`)
         .text(`Procesado por: Usuario ID ${pago.is_user}`);
      
      doc.moveDown(2);
      doc.fontSize(10).text('Este documento es generado automáticamente por el sistema.', { align: 'center' });
      
      doc.end();
      
      this.logger.log(`PDF de egreso generado: ${fileName}`);
      return filePath;
      
    } catch (error) {
      this.logger.error(`Error generando PDF: ${error.message}`);
      throw error;
    }
  }

  generarReporteEgresosPDF(pagos: any[]): string {
    try {
      const doc = new PDFDocument();
      const fileName = `reporte_egresos_${Date.now()}.pdf`;
      const egresoDir = path.join(process.cwd(), 'egresos');
      
      if (!fs.existsSync(egresoDir)) {
        fs.mkdirSync(egresoDir, { recursive: true });
      }
      
      const filePath = path.join(egresoDir, fileName);
      doc.pipe(fs.createWriteStream(filePath));

      // Encabezado
      doc.fontSize(18).text('REPORTE GENERAL DE EGRESOS', { align: 'center' });
      doc.fontSize(10).text(`Fecha de generación: ${new Date().toLocaleDateString('es-ES')}`, { align: 'center' });
      doc.moveDown(2);

      // Resumen
      const totalMonto = pagos.reduce((sum, p) => sum + p.monto, 0);
      doc.fontSize(12).text(`Total de pagos: ${pagos.length}`, { align: 'right' });
      doc.text(`Monto total: $${totalMonto.toFixed(2)}`, { align: 'right' });
      doc.moveDown();

      // Tabla de pagos
      doc.fontSize(10);
      pagos.forEach((pago, index) => {
        if (index > 0) doc.moveDown(0.5);
        doc.text(`${index + 1}. ${pago.nomina?.trabajador?.nombre || 'N/A'} - $${pago.monto} - ${new Date(pago.fecha).toLocaleDateString('es-ES')}`);
      });

      doc.end();
      this.logger.log(`Reporte de egresos generado: ${fileName}`);
      return filePath;
    } catch (error) {
      this.logger.error(`Error generando reporte: ${error.message}`);
      throw error;
    }
  }

  generarReporteMensualPDF(pagos: any[], mes: number, anio: number): string {
    try {
      const doc = new PDFDocument();
      const fileName = `reporte_mensual_${mes}_${anio}_${Date.now()}.pdf`;
      const egresoDir = path.join(process.cwd(), 'egresos');
      
      if (!fs.existsSync(egresoDir)) {
        fs.mkdirSync(egresoDir, { recursive: true });
      }
      
      const filePath = path.join(egresoDir, fileName);
      doc.pipe(fs.createWriteStream(filePath));

      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

      // Encabezado
      doc.fontSize(18).text(`REPORTE DE EGRESOS - ${meses[mes-1]} ${anio}`, { align: 'center' });
      doc.fontSize(10).text(`Fecha de generación: ${new Date().toLocaleDateString('es-ES')}`, { align: 'center' });
      doc.moveDown(2);

      // Resumen mensual
      const totalMonto = pagos.reduce((sum, p) => sum + p.monto, 0);
      doc.fontSize(12).text(`Total de pagos en ${meses[mes-1]}: ${pagos.length}`, { align: 'right' });
      doc.text(`Monto total del mes: $${totalMonto.toFixed(2)}`, { align: 'right' });
      doc.moveDown();

      // Detalle por empleado
      doc.fontSize(10);
      if (pagos.length === 0) {
        doc.text('No hay pagos registrados en este mes.');
      } else {
        pagos.forEach((pago, index) => {
          if (index > 0) doc.moveDown(0.5);
          doc.text(`${index + 1}. ${pago.nomina?.trabajador?.nombre || 'N/A'} - $${pago.monto} - ${new Date(pago.fecha).toLocaleDateString('es-ES')}`);
        });
      }

      doc.end();
      this.logger.log(`Reporte mensual generado: ${fileName}`);
      return filePath;
    } catch (error) {
      this.logger.error(`Error generando reporte mensual: ${error.message}`);
      throw error;
    }
  }
}
