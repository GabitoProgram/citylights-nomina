import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Generar PDF de comprobante de pago de nómina
   */
  async generarComprobantePago(pagoId: number): Promise<string> {
    try {
      console.log('🔍 [PDF Service] Buscando pago con ID:', pagoId);
      
      // Obtener datos del pago, nómina y trabajador
      const pago = await this.prisma.pagar.findUnique({
        where: { id: pagoId },
        include: {
          nomina: {
            include: { trabajador: true }
          }
        }
      });

      console.log('🔍 [PDF Service] Pago encontrado:', pago ? 'SÍ' : 'NO');
      if (pago) {
        console.log('🔍 [PDF Service] Datos del pago:', {
          id: pago.id,
          monto: pago.monto,
          nominaId: pago.nominaId
        });
      }

      if (!pago) {
        throw new Error('Pago no encontrado');
      }

      // Crear el documento PDF
      const doc = new (PDFDocument as any)({ margin: 50 });
      const fileName = `comprobante_nomina_${pago.id}_${Date.now()}.pdf`;
      const filePath = path.join(process.cwd(), 'facturas', fileName);

      // Asegurar que el directorio existe
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Pipe del documento al archivo
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // Encabezado de la empresa
      doc.fontSize(20)
         .text('SISTEMA DE NÓMINA', 50, 50)
         .fontSize(16)
         .text('Comprobante de Pago', 50, 80);

      // Información de la empresa
      doc.fontSize(12)
         .text('Empresa: CitiLights Residencial', 50, 120)
         .text('NIT: 123456789', 50, 140)
         .text('Dirección: Av. Principal #123', 50, 160)
         .text('Teléfono: +591 2 1234567', 50, 180);

      // Línea separadora
      doc.moveTo(50, 210)
         .lineTo(550, 210)
         .stroke();

      // Información del trabajador
      doc.fontSize(14)
         .text('INFORMACIÓN DEL TRABAJADOR', 50, 230);

      doc.fontSize(12)
         .text(`Nombre: ${pago.nomina.trabajador.nombre}`, 50, 260)
         .text(`Tipo: ${pago.nomina.trabajador.tipo}`, 50, 280)
         .text(`Sueldo Base: $${pago.nomina.trabajador.sueldo.toFixed(2)}`, 50, 300);

      // Información de la nómina
      doc.fontSize(14)
         .text('DETALLES DE LA NÓMINA', 50, 340);

      doc.fontSize(12)
         .text(`Período: ${new Date(pago.nomina.fecha).toLocaleDateString('es-ES')}`, 50, 370)
         .text(`Cantidad Base: $${pago.nomina.cantidad.toFixed(2)}`, 50, 390)
         .text(`Extras: $${pago.nomina.extra.toFixed(2)}`, 50, 410)
         .text(`Total Nómina: $${(pago.nomina.cantidad + pago.nomina.extra).toFixed(2)}`, 50, 430);

      // Información del pago
      doc.fontSize(14)
         .text('INFORMACIÓN DEL PAGO', 50, 470);

      doc.fontSize(12)
         .text(`ID de Pago: ${pago.id}`, 50, 500)
         .text(`Monto Pagado: $${pago.monto.toFixed(2)}`, 50, 520)
         .text(`Fecha de Pago: ${new Date(pago.fecha).toLocaleDateString('es-ES')}`, 50, 540)
         .text(`Procesado por: ${pago.is_user}`, 50, 560);

      // Generar código QR con información del pago
      const qrData = JSON.stringify({
        pago_id: pago.id,
        trabajador: pago.nomina.trabajador.nombre,
        monto: pago.monto,
        fecha: pago.fecha,
        nomina_id: pago.nominaId
      });

      const qrCodeBuffer = await QRCode.toBuffer(qrData, {
        width: 150,
        margin: 2
      });

      // Insertar QR en el PDF
      doc.image(qrCodeBuffer, 400, 500, { width: 100 });

      // Pie de página
      doc.fontSize(10)
         .text('Este es un comprobante de pago generado automáticamente', 50, 650)
         .text('Para verificar la autenticidad, escanee el código QR', 50, 670)
         .text(`Generado el: ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES')}`, 50, 690);

      // Finalizar el documento
      doc.end();

      // Esperar a que el archivo se escriba completamente
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => {
          console.log('✅ [PDF Service] Archivo escrito completamente:', fileName);
          resolve();
        });
        writeStream.on('error', (error) => {
          console.error('❌ [PDF Service] Error escribiendo archivo:', error);
          reject(error);
        });
      });

      this.logger.log(`PDF generado: ${fileName}`);
      return filePath;

    } catch (error) {
      this.logger.error(`Error generando PDF: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generar reporte mensual de nóminas
   */
  async generarReporteMensual(mes: number, año: number): Promise<string> {
    try {
      // Obtener nóminas del mes
      const fechaInicio = new Date(año, mes - 1, 1);
      const fechaFin = new Date(año, mes, 0);

      const nominas = await this.prisma.nomina.findMany({
        where: {
          fecha: {
            gte: fechaInicio,
            lte: fechaFin
          }
        },
        include: {
          trabajador: true,
          pagos: true
        },
        orderBy: { fecha: 'asc' }
      });

      // Crear el documento PDF
      const doc = new (PDFDocument as any)({ margin: 50 });
      const fileName = `reporte_nominas_${año}_${mes}_${Date.now()}.pdf`;
      const filePath = path.join(process.cwd(), 'facturas', fileName);

      // Pipe del documento al archivo
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // Encabezado
      doc.fontSize(18)
         .text('REPORTE MENSUAL DE NÓMINAS', 50, 50)
         .fontSize(14)
         .text(`Período: ${fechaInicio.toLocaleDateString('es-ES')} - ${fechaFin.toLocaleDateString('es-ES')}`, 50, 80);

      let yPosition = 120;
      let totalGeneral = 0;

      // Tabla de nóminas
      nominas.forEach((nomina, index) => {
        const total = nomina.cantidad + nomina.extra;
        totalGeneral += total;

        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
        }

        doc.fontSize(10)
           .text(`${index + 1}`, 50, yPosition)
           .text(nomina.trabajador.nombre, 80, yPosition)
           .text(nomina.trabajador.tipo, 200, yPosition)
           .text(`$${nomina.cantidad.toFixed(2)}`, 300, yPosition)
           .text(`$${nomina.extra.toFixed(2)}`, 380, yPosition)
           .text(`$${total.toFixed(2)}`, 460, yPosition);

        yPosition += 20;
      });

      // Total general
      doc.fontSize(12)
         .text(`TOTAL GENERAL: $${totalGeneral.toFixed(2)}`, 350, yPosition + 20);

      doc.end();

      // Esperar a que el archivo se escriba completamente
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => {
          console.log('✅ [PDF Service] Reporte mensual escrito completamente:', fileName);
          resolve();
        });
        writeStream.on('error', (error) => {
          console.error('❌ [PDF Service] Error escribiendo reporte:', error);
          reject(error);
        });
      });

      this.logger.log(`Reporte mensual generado: ${fileName}`);
      return filePath;

    } catch (error) {
      this.logger.error(`Error generando reporte: ${error.message}`);
      throw error;
    }
  }
}