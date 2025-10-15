import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CuotaConfigService } from '../cuota-config/cuota-config.service';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { jsPDF } from 'jspdf';

@Injectable()
export class FacturaNominaService {
  private readonly logger = new Logger(FacturaNominaService.name);

  constructor(
    private prisma: PrismaService,
    private cuotaConfigService: CuotaConfigService,
  ) {}

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

  /**
   * Generar factura para cuota de residente
   */
  async generarFacturaCuotaResidente(datos: {
    trabajadorNombre: string;
    trabajadorEmail: string;
    total: number;
    concepto: string;
    tipo: string;
    periodo: string;
    cuotaId: number;
  }) {
    try {
      // Crear número de factura único
      const numeroFactura = `CUOTA-${datos.cuotaId.toString().padStart(8, '0')}`;
      
      this.logger.log(`✅ Datos de factura preparados para cuota ${datos.cuotaId}: ${numeroFactura}`);

      // Retornar datos de la factura para el sistema de booking
      return {
        numeroFactura,
        trabajadorNombre: datos.trabajadorNombre,
        total: datos.total,
        estado: 'GENERADA',
        fechaCreacion: new Date().toISOString(),
        concepto: datos.concepto,
        periodo: datos.periodo,
        tipo: datos.tipo
      };

    } catch (error) {
      this.logger.error(`❌ Error preparando datos de factura para cuota: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generar PDF de factura para cuota de residente con desglose detallado
   */
  async generarPDFCuotaResidente(datos: {
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
  }): Promise<Buffer> {
    try {
      this.logger.log(`🔄 Generando PDF para cuota ${datos.cuotaId}: ${datos.numeroFactura}`);
      this.logger.log(`📝 Datos recibidos: ${JSON.stringify(datos)}`);

      // 🆕 OBTENER CONFIGURACIÓN DE CONCEPTOS DE CUOTA
      let detallesFactura = datos.detalles;
      
      if (!detallesFactura) {
        try {
          const configuracion = await this.cuotaConfigService.obtenerConfiguracion();
          
          if (configuracion?.conceptos) {
            // Crear detalles basados en la configuración actual
            detallesFactura = [];
            const conceptos = configuracion.conceptos;
            
            // Solo agregar conceptos que tengan valor mayor a 0
            if (conceptos.jardinFrente > 0) {
              detallesFactura.push({
                descripcion: 'Jardín Frente',
                cantidad: 1,
                precio: conceptos.jardinFrente,
                total: conceptos.jardinFrente
              });
            }
            
            if (conceptos.jardinGeneral > 0) {
              detallesFactura.push({
                descripcion: 'Jardín General',
                cantidad: 1,
                precio: conceptos.jardinGeneral,
                total: conceptos.jardinGeneral
              });
            }
            
            if (conceptos.recojoBasura > 0) {
              detallesFactura.push({
                descripcion: 'Recojo de Basura',
                cantidad: 1,
                precio: conceptos.recojoBasura,
                total: conceptos.recojoBasura
              });
            }
            
            if (conceptos.limpieza > 0) {
              detallesFactura.push({
                descripcion: 'Limpieza',
                cantidad: 1,
                precio: conceptos.limpieza,
                total: conceptos.limpieza
              });
            }
            
            if (conceptos.luzGradas > 0) {
              detallesFactura.push({
                descripcion: 'Luz Gradas',
                cantidad: 1,
                precio: conceptos.luzGradas,
                total: conceptos.luzGradas
              });
            }
            
            if (conceptos.cera > 0) {
              detallesFactura.push({
                descripcion: 'Cera',
                cantidad: 1,
                precio: conceptos.cera,
                total: conceptos.cera
              });
            }
            
            if (conceptos.ace > 0) {
              detallesFactura.push({
                descripcion: 'Ace',
                cantidad: 1,
                precio: conceptos.ace,
                total: conceptos.ace
              });
            }
            
            if (conceptos.lavanderia > 0) {
              detallesFactura.push({
                descripcion: 'Lavandería',
                cantidad: 1,
                precio: conceptos.lavanderia,
                total: conceptos.lavanderia
              });
            }
            
            if (conceptos.ahorroAdministracion > 0) {
              detallesFactura.push({
                descripcion: 'Ahorro Administración',
                cantidad: 1,
                precio: conceptos.ahorroAdministracion,
                total: conceptos.ahorroAdministracion
              });
            }
            
            if (conceptos.agua > 0) {
              detallesFactura.push({
                descripcion: 'Agua',
                cantidad: 1,
                precio: conceptos.agua,
                total: conceptos.agua
              });
            }
            
            this.logger.log(`✅ Desglose de conceptos obtenido: ${detallesFactura.length} items`);
          }
        } catch (configError) {
          this.logger.warn(`⚠️ No se pudo obtener configuración de conceptos: ${configError.message}`);
          // Usar valor por defecto si no hay configuración
        }
      }
      
      // Si no hay detalles específicos, usar datos por defecto
      if (!detallesFactura || detallesFactura.length === 0) {
        detallesFactura = [
          {
            descripcion: datos.concepto,
            cantidad: 1,
            precio: datos.total,
            total: datos.total
          }
        ];
      }

      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          bufferPages: true
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        // ENCABEZADO
        doc.fontSize(20)
           .fillColor('#2563eb')
           .text('CITYLIGHTS - FACTURA DE CUOTA', 50, 50);

        doc.fontSize(12)
           .fillColor('#000000')
           .text(`Número de Factura: ${datos.numeroFactura}`, 50, 90)
           .text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 50, 110)
           .text(`Período: ${datos.periodo}`, 50, 130);

        // LÍNEA SEPARADORA
        doc.moveTo(50, 160)
           .lineTo(545, 160)
           .stroke();

        // DATOS DEL CLIENTE
        doc.fontSize(14)
           .fillColor('#1f2937')
           .text('DATOS DEL RESIDENTE', 50, 180);

        doc.fontSize(12)
           .fillColor('#000000')
           .text(`Nombre: ${datos.clienteNombre}`, 50, 210)
           .text(`Email: ${datos.clienteEmail}`, 50, 230)
           .text(`Concepto: ${datos.concepto}`, 50, 250);

        // DETALLES DE LA FACTURA
        let yPosition = 290;
        doc.fontSize(14)
           .fillColor('#1f2937')
           .text('DETALLE DE LA FACTURA', 50, yPosition);

        yPosition += 30;

        // Encabezados de tabla
        doc.fontSize(10)
           .fillColor('#6b7280')
           .text('DESCRIPCIÓN', 50, yPosition)
           .text('CANT.', 350, yPosition)
           .text('PRECIO', 400, yPosition)
           .text('TOTAL', 480, yPosition);

        yPosition += 20;

        // Línea bajo encabezados
        doc.moveTo(50, yPosition)
           .lineTo(545, yPosition)
           .stroke();

        yPosition += 15;

        // Usar los detalles configurados
        doc.fontSize(10)
           .fillColor('#000000');

        detallesFactura.forEach((detalle) => {
          doc.text(detalle.descripcion, 50, yPosition)
             .text(detalle.cantidad.toString(), 350, yPosition)
             .text(`$${detalle.precio.toFixed(2)}`, 400, yPosition)
             .text(`$${detalle.total.toFixed(2)}`, 480, yPosition);
          
          yPosition += 20;
        });

        // Línea antes del total
        yPosition += 10;
        doc.moveTo(350, yPosition)
           .lineTo(545, yPosition)
           .stroke();

        // TOTAL
        yPosition += 20;
        doc.fontSize(14)
           .fillColor('#1f2937')
           .text('TOTAL A PAGAR:', 350, yPosition)
           .fontSize(16)
           .fillColor('#dc2626')
           .text(`$${datos.total.toFixed(2)}`, 480, yPosition);

        // PIE DE PÁGINA
        const footerY = 720;
        doc.fontSize(8)
           .fillColor('#6b7280')
           .text('CitiLights - Sistema de Gestión de Cuotas Residenciales', 50, footerY)
           .text(`Factura generada el ${new Date().toLocaleString('es-ES')}`, 50, footerY + 12)
           .text('Esta es una factura digital generada automáticamente.', 50, footerY + 24);

        doc.end();
      });

    } catch (error) {
      this.logger.error(`❌ Error generando PDF para cuota: ${error.message}`);
      throw error;
    }
  }
}