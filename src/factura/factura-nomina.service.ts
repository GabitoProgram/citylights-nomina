import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class FacturaNominaService {
  private readonly logger = new Logger(FacturaNominaService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Generar factura boliviana automáticamente después de confirmar un pago de nómina
   */
  async generarFacturaAutomatica(pagoId: number) {
    try {
      // Verificar si ya existe un archivo de factura para este pago
      const dir = path.join(process.cwd(), 'facturas');
      
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(file => file.includes(`factura_nomina_${pagoId}_`));
        if (files.length > 0) {
          this.logger.log(`Factura ya existe para pago ${pagoId}: ${files[0]}`);
          return { 
            pagoId, 
            numeroFactura: `NOM-${pagoId.toString().padStart(8, '0')}`,
            archivo: files[0],
            existe: true
          };
        }
      }

      // Obtener datos del pago, nómina y trabajador
      const pago = await this.prisma.pagar.findUnique({
        where: { id: pagoId },
        include: {
          nomina: {
            include: { trabajador: true }
          }
        }
      });

      if (!pago) {
        throw new Error(`Pago ${pagoId} no encontrado`);
      }

      // Datos de la empresa (CitiLights Nóminas)
      const datosEmpresa = {
        nit: '1234567890123',
        razonSocial: 'CITYLIGHTS NOMINAS S.R.L.',
        numeroAutorizacion: '29040011008',
        nombre: 'CITYLIGHTS NOMINAS',
        direccion: 'Av. Arce #2345, Edificio Torre Empresarial, Piso 16, La Paz, Bolivia',
        telefono: '+591 2 2345679',
        email: 'nominas@citylights.com',
        sucursal: 'Departamento de RRHH',
        municipio: 'La Paz',
        actividadEconomica: '820200 - Actividades de servicios de apoyo administrativo'
      };

      // Generar número de factura único
      const numeroFactura = `NOM-${pagoId.toString().padStart(8, '0')}`;
      const codigoControl = this.generarCodigoControl(numeroFactura, datosEmpresa.nit, pago.monto);
      
      // Crear datos de factura
      const datosFactura = {
        pagoId,
        numeroFactura,
        nit: datosEmpresa.nit,
        razonSocial: datosEmpresa.razonSocial,
        numeroAutorizacion: datosEmpresa.numeroAutorizacion,
        codigoControl,
        trabajadorNombre: pago.nomina.trabajador.nombre,
        trabajadorTipo: pago.nomina.trabajador.tipo,
        empresaNombre: datosEmpresa.nombre,
        empresaNit: datosEmpresa.nit,
        empresaDireccion: datosEmpresa.direccion,
        empresaTelefono: datosEmpresa.telefono,
        empresaEmail: datosEmpresa.email,
        sucursal: datosEmpresa.sucursal,
        municipio: datosEmpresa.municipio,
        subtotal: pago.monto,
        total: pago.monto,
        actividadEconomica: datosEmpresa.actividadEconomica,
        leyenda: this.obtenerLeyendaFiscal(pago.monto),
        usuario: pago.is_user,
        fechaCreacion: new Date(),
        pago: pago
      };

      this.logger.log(`✅ Generando factura ${numeroFactura} para pago ${pagoId}`);
      
      // Generar el PDF de la factura directamente
      const archivoPath = await this.generarPDFFactura(datosFactura);
      
      return {
        ...datosFactura,
        archivo: path.basename(archivoPath)
      };

    } catch (error) {
      this.logger.error(`Error generando factura automática: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generar PDF de la factura boliviana
   */
  async generarPDFFactura(datosFactura: any): Promise<string> {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const fileName = `factura_nomina_${datosFactura.pagoId}_${Date.now()}.pdf`;
      const filePath = path.join(process.cwd(), 'facturas', fileName);

      // Asegurar que el directorio existe
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      doc.pipe(fs.createWriteStream(filePath));

      // === CABECERA FISCAL ===
      doc.fontSize(18)
         .text('FACTURA BOLIVIANA', 200, 50, { align: 'center' })
         .fontSize(12)
         .text(`Nº ${datosFactura.numeroFactura}`, 250, 75, { align: 'center' });

      // Datos de la empresa
      doc.fontSize(14)
         .text(datosFactura.empresaNombre, 50, 110)
         .fontSize(10)
         .text(`NIT: ${datosFactura.empresaNit}`, 50, 130)
         .text(`No. Autorización: ${datosFactura.numeroAutorizacion}`, 50, 145)
         .text(datosFactura.empresaDireccion, 50, 160)
         .text(`Tel: ${datosFactura.empresaTelefono}`, 50, 175)
         .text(`Email: ${datosFactura.empresaEmail}`, 50, 190);

      // === INFORMACIÓN DE LA TRANSACCIÓN ===
      doc.fontSize(12)
         .text('DATOS DEL PAGO DE NÓMINA:', 50, 230);

      doc.fontSize(10)
         .text(`Trabajador: ${datosFactura.trabajadorNombre}`, 50, 250)
         .text(`Tipo de Empleado: ${datosFactura.trabajadorTipo}`, 50, 265)
         .text(`Concepto: Pago de Nómina - ${datosFactura.trabajadorTipo}`, 50, 280)
         .text(`Período: ${new Date(datosFactura.pago.nomina.fecha).toLocaleDateString('es-BO')}`, 50, 295)
         .text(`Fecha de Pago: ${new Date(datosFactura.pago.fecha).toLocaleDateString('es-BO')}`, 50, 310);

      // === DETALLE DE MONTOS ===
      const tableTop = 350;
      
      // Cabecera de tabla
      doc.rect(50, tableTop, 495, 20).fill('#f0f0f0');
      doc.fill('#000')
         .fontSize(10)
         .text('DESCRIPCIÓN', 60, tableTop + 5)
         .text('CANTIDAD', 300, tableTop + 5)
         .text('PRECIO UNIT.', 380, tableTop + 5)
         .text('TOTAL', 480, tableTop + 5);

      // Línea de detalle
      const lineTop = tableTop + 25;
      doc.text(`Pago de Nómina - ${datosFactura.trabajadorTipo}`, 60, lineTop)
         .text('1', 300, lineTop)
         .text(`Bs. ${datosFactura.subtotal.toFixed(2)}`, 380, lineTop)
         .text(`Bs. ${datosFactura.total.toFixed(2)}`, 480, lineTop);

      // Totales
      const totalsTop = lineTop + 40;
      doc.fontSize(11)
         .text(`SUBTOTAL: Bs. ${datosFactura.subtotal.toFixed(2)}`, 350, totalsTop)
         .text(`DESCUENTO: Bs. 0.00`, 350, totalsTop + 15)
         .text(`TOTAL: Bs. ${datosFactura.total.toFixed(2)}`, 350, totalsTop + 30);

      // === QR CÓDIGO ===
      const qrData = {
        nit: datosFactura.empresaNit,
        numeroFactura: datosFactura.numeroFactura,
        fecha: datosFactura.fechaCreacion.toISOString().split('T')[0],
        monto: datosFactura.total,
        codigoControl: datosFactura.codigoControl
      };
      
      const qrBuffer = await QRCode.toBuffer(JSON.stringify(qrData), { width: 100 });
      doc.image(qrBuffer, 450, totalsTop + 60, { width: 80 });

      // === PIE FISCAL ===
      doc.fontSize(8)
         .text(`Código de Control: ${datosFactura.codigoControl}`, 50, totalsTop + 80)
         .text(`Actividad Económica: ${datosFactura.actividadEconomica}`, 50, totalsTop + 95)
         .text(`"${datosFactura.leyenda}"`, 50, totalsTop + 110, { width: 400 });

      doc.end();

      this.logger.log(`PDF de factura generado: ${fileName}`);
      return filePath;

    } catch (error) {
      this.logger.error(`Error generando PDF de factura: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generar código de control fiscal
   */
  private generarCodigoControl(numeroFactura: string, nit: string, monto: number): string {
    const datos = `${numeroFactura}${nit}${monto.toFixed(2)}${new Date().getTime()}`;
    return crypto.createHash('sha256').update(datos).digest('hex').substring(0, 16).toUpperCase();
  }

  /**
   * Obtener leyenda fiscal según el monto
   */
  private obtenerLeyendaFiscal(monto: number): string {
    if (monto <= 1000) {
      return 'Ley N° 453: Tienes derecho a recibir información sobre las características y contenidos de los servicios que utilices.';
    } else if (monto <= 5000) {
      return 'Ley N° 453: Es deber y derecho de todos los ciudadanos el cumplimiento y exigencia del cumplimiento de la Constitución Política del Estado y las leyes de la República.';
    } else {
      return 'Ley N° 453: Para efectos tributarios, verifique que los datos de la factura correspondan con la información de su proveedor.';
    }
  }

  /**
   * Obtener facturas generadas (listar archivos PDF)
   */
  async obtenerFacturas() {
    try {
      const dir = path.join(process.cwd(), 'facturas');
      
      if (!fs.existsSync(dir)) {
        return [];
      }

      const archivos = fs.readdirSync(dir)
        .filter(file => file.startsWith('factura_nomina_') && file.endsWith('.pdf'))
        .map(file => {
          const stats = fs.statSync(path.join(dir, file));
          const pagoId = file.match(/factura_nomina_(\d+)_/)?.[1];
          
          return {
            id: parseInt(pagoId || '0'),
            numeroFactura: `NOM-${pagoId?.padStart(8, '0')}`,
            archivo: file,
            fechaCreacion: stats.birthtime.toISOString(),
            trabajadorNombre: 'Ver archivo PDF',
            total: 0,
            estado: 'GENERADA'
          };
        })
        .sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime());

      return archivos;
    } catch (error) {
      this.logger.error(`Error obteniendo facturas: ${error.message}`);
      return [];
    }
  }

  /**
   * Obtener ruta de archivo de factura por ID de pago
   */
  async obtenerRutaFacturaPorPago(pagoId: number): Promise<string | null> {
    try {
      const dir = path.join(process.cwd(), 'facturas');
      
      if (!fs.existsSync(dir)) {
        return null;
      }

      const archivos = fs.readdirSync(dir)
        .filter(file => file.includes(`factura_nomina_${pagoId}_`));

      if (archivos.length > 0) {
        return path.join(dir, archivos[0]);
      }

      return null;
    } catch (error) {
      this.logger.error(`Error buscando factura para pago ${pagoId}: ${error.message}`);
      return null;
    }
  }
}