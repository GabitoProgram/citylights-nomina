import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';

// Importaciones dinámicas para jsPDF
let jsPDF: any;
let autoTable: any;

@Injectable()
export class ReportesService {
  constructor(
    private prisma: PrismaService,
    private httpService: HttpService
  ) {
    this.initializePDFLibraries();
  }

  private async initializePDFLibraries() {
    try {
      console.log('🔍 [ReportesService] Cargando librerías PDF...');
      
      const jsPDFModule = await import('jspdf');
      jsPDF = jsPDFModule.default || jsPDFModule;
      console.log('✅ [ReportesService] jsPDF cargado:', !!jsPDF);
      
      const autoTableModule = await import('jspdf-autotable');
      autoTable = autoTableModule.default || autoTableModule;
      console.log('✅ [ReportesService] autoTable cargado:', !!autoTable);
      
    } catch (error) {
      console.error('❌ [ReportesService] Error loading PDF libraries:', error);
      throw error;
    }
  }

  async obtenerDatosCompletos(fechaInicio?: string, fechaFin?: string) {
    // Obtener datos de nómina (egresos)
    const egresos = await this.prisma.pagar.findMany({
      where: {
        ...(fechaInicio && fechaFin && {
          fechaPago: {
            gte: new Date(fechaInicio),
            lte: new Date(fechaFin + 'T23:59:59.999Z')
          }
        }),
        estado: 'COMPLETADO'
      },
      include: {
        nomina: {
          include: {
            trabajador: true
          }
        }
      }
    });

    // Obtener datos de booking-service-copia (ingresos) - TEMPORALMENTE DESHABILITADO
    let ingresos = [];
    // try {
    //   const bookingUrl = 'http://localhost:3004/reserva/reportes/ingresos';
    //   const params = fechaInicio && fechaFin ? `?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}` : '';
    //   
    //   const response = await firstValueFrom(
    //     this.httpService.get(`${bookingUrl}${params}`)
    //   );
    //   ingresos = (response as any).data;
    // } catch (error) {
    //   console.error('Error obteniendo ingresos:', error);
    //   ingresos = [];
    // }
    
    console.log('🔍 [ReportesService] Usando solo datos de egresos (nómina)');
    console.log('💡 [ReportesService] Para incluir ingresos, asegurar que booking-service-copia esté corriendo con el endpoint /reserva/reportes/ingresos');

    // Calcular totales
    const totalIngresos = ingresos.reduce((sum: number, ingreso: any) => sum + ingreso.totalIngresos, 0);
    const totalEgresos = egresos.reduce((sum, egreso) => sum + egreso.monto, 0);
    const balance = totalIngresos - totalEgresos;

    return {
      ingresos,
      egresos,
      resumen: {
        totalIngresos,
        totalEgresos,
        balance,
        fechaGeneracion: new Date().toLocaleString('es-ES'),
        periodo: fechaInicio && fechaFin ? `${fechaInicio} - ${fechaFin}` : 'Todo el período'
      }
    };
  }

  async generarReportePDF(fechaInicio?: string, fechaFin?: string): Promise<Buffer> {
    try {
      console.log('🔍 [ReportePDF] Iniciando generación de PDF...');
      
      if (!jsPDF) {
        console.log('🔍 [ReportePDF] Inicializando librerías PDF...');
        await this.initializePDFLibraries();
      }

      if (!jsPDF) {
        throw new Error('No se pudo cargar jsPDF');
      }

      console.log('🔍 [ReportePDF] Obteniendo datos...');
      const datos = await this.obtenerDatosCompletos(fechaInicio, fechaFin);
      console.log('🔍 [ReportePDF] Datos obtenidos:', {
        ingresos: datos.ingresos.length,
        egresos: datos.egresos.length,
        resumen: datos.resumen
      });
      
      const doc = new jsPDF();
      
      // Configurar fuente y título
      doc.setFontSize(20);
      doc.setTextColor(75, 0, 130); // Púrpura
      doc.text('REPORTE FINANCIERO CITYLIGHTS', 20, 25);
      
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Período: ${datos.resumen.periodo}`, 20, 35);
      doc.text(`Generado: ${datos.resumen.fechaGeneracion}`, 20, 42);

      // Resumen financiero
      doc.setFontSize(16);
      doc.setTextColor(75, 0, 130);
      doc.text('RESUMEN FINANCIERO', 20, 58);
      
      const resumenData = [
        ['Total Ingresos', `$${datos.resumen.totalIngresos.toLocaleString()}`],
        ['Total Egresos', `$${datos.resumen.totalEgresos.toLocaleString()}`],
        ['Balance', `$${datos.resumen.balance.toLocaleString()}`]
      ];

      if (autoTable) {
        autoTable(doc, {
          startY: 65,
          head: [['Concepto', 'Monto']],
          body: resumenData,
          theme: 'grid',
          headStyles: { fillColor: [147, 51, 234] }, // Púrpura
          margin: { left: 20, right: 20 }
        });

        // Tabla de ingresos (solo si hay datos)
        if (datos.ingresos.length > 0) {
          let currentY = (doc as any).lastAutoTable.finalY + 15;
          doc.setFontSize(14);
          doc.setTextColor(75, 0, 130);
          doc.text('INGRESOS POR ÁREA', 20, currentY);

          const ingresosData = datos.ingresos.map((ing: any) => [
            ing.nombre,
            ing.cantidadReservas.toString(),
            `$${ing.totalIngresos.toLocaleString()}`
          ]);

          autoTable(doc, {
            startY: currentY + 5,
            head: [['Área Común', 'Reservas', 'Total Ingresos']],
            body: ingresosData,
            theme: 'striped',
            headStyles: { fillColor: [34, 197, 94] }, // Verde
            margin: { left: 20, right: 20 }
          });
        }

        // Tabla de egresos
        let currentY = datos.ingresos.length > 0 ? (doc as any).lastAutoTable.finalY + 15 : 100;
        doc.setFontSize(14);
        doc.setTextColor(75, 0, 130);
        doc.text('EGRESOS POR EMPLEADO', 20, currentY);

        const egresosData = datos.egresos.map((egr: any) => [
          egr.nomina.trabajador.nombre,
          egr.nomina.trabajador.tipo,
          new Date(egr.fechaPago).toLocaleDateString('es-ES'),
          `$${egr.monto.toLocaleString()}`
        ]);

        autoTable(doc, {
          startY: currentY + 5,
          head: [['Empleado', 'Tipo', 'Fecha Pago', 'Monto']],
          body: egresosData,
          theme: 'striped',
          headStyles: { fillColor: [239, 68, 68] }, // Rojo
          margin: { left: 20, right: 20 }
        });
      }

      console.log('🔍 [ReportePDF] Generando buffer...');
      const pdfArrayBuffer = doc.output('arraybuffer');
      const pdfBuffer = Buffer.from(pdfArrayBuffer);
      
      console.log('✅ [ReportePDF] PDF generado exitosamente. Tamaño:', pdfBuffer.length, 'bytes');
      return pdfBuffer;
      
    } catch (error) {
      console.error('❌ [ReportePDF] Error generando PDF:', error);
      throw new Error(`Error generando PDF: ${error.message}`);
    }
  }

  async generarReporteExcel(fechaInicio?: string, fechaFin?: string): Promise<Buffer> {
    try {
      console.log('🔍 [ReporteExcel] Iniciando generación de Excel...');
      
      const datos = await this.obtenerDatosCompletos(fechaInicio, fechaFin);
      console.log('🔍 [ReporteExcel] Datos obtenidos:', {
        ingresos: datos.ingresos.length,
        egresos: datos.egresos.length
      });
      
      const workbook = XLSX.utils.book_new();

      // Hoja de resumen
      const resumenData = [
        ['REPORTE FINANCIERO CITYLIGHTS'],
        [`Período: ${datos.resumen.periodo}`],
        [`Generado: ${datos.resumen.fechaGeneracion}`],
        [],
        ['RESUMEN FINANCIERO'],
        ['Concepto', 'Monto'],
        ['Total Ingresos', datos.resumen.totalIngresos],
        ['Total Egresos', datos.resumen.totalEgresos],
        ['Balance', datos.resumen.balance]
      ];

      const resumenSheet = XLSX.utils.aoa_to_sheet(resumenData);
      XLSX.utils.book_append_sheet(workbook, resumenSheet, 'Resumen');

      // Hoja de ingresos (solo si hay datos)
      if (datos.ingresos.length > 0) {
        const ingresosData = [
          ['Área Común', 'Cantidad Reservas', 'Total Ingresos', 'Ingreso Promedio'],
          ...datos.ingresos.map((ing: any) => [
            ing.nombre,
            ing.cantidadReservas,
            ing.totalIngresos,
            ing.ingresoPromedio
          ])
        ];

        const ingresosSheet = XLSX.utils.aoa_to_sheet(ingresosData);
        XLSX.utils.book_append_sheet(workbook, ingresosSheet, 'Ingresos');
      }

      // Hoja de egresos
      const egresosData = [
        ['Empleado', 'Tipo', 'Fecha Pago', 'Monto', 'Nómina ID'],
        ...datos.egresos.map((egr: any) => [
          egr.nomina.trabajador.nombre,
          egr.nomina.trabajador.tipo,
          new Date(egr.fechaPago).toLocaleDateString('es-ES'),
          egr.monto,
          egr.nomina.id
        ])
      ];

      const egresosSheet = XLSX.utils.aoa_to_sheet(egresosData);
      XLSX.utils.book_append_sheet(workbook, egresosSheet, 'Egresos');

      console.log('🔍 [ReporteExcel] Generando buffer...');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      console.log('✅ [ReporteExcel] Excel generado exitosamente. Tamaño:', buffer.length, 'bytes');
      return buffer;
      
    } catch (error) {
      console.error('❌ [ReporteExcel] Error generando Excel:', error);
      throw new Error(`Error generando Excel: ${error.message}`);
    }
  }
}