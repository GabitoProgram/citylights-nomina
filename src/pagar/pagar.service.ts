import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { PdfService } from './pdf.service';

@Injectable()
export class PagarService {
  private prisma = new PrismaClient();
  private stripe: Stripe;
  private pdfService = new PdfService();
  private readonly logger = new Logger(PagarService.name);

  constructor() {
    // Solo inicializar Stripe si hay clave válida
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey && stripeKey !== 'sk_test_tu_clave_aqui') {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2022-11-15' });
    }
  }

  async findAll() {
    return this.prisma.pagar.findMany({ include: { nomina: { include: { trabajador: true } } } });
  }

  async create(data: any, user: { id: string, nombre: string, rol: string }) {
    try {
      let paymentIntent = null;
      
      // Solo crear pago en Stripe si está configurado
      if (this.stripe) {
        paymentIntent = await this.stripe.paymentIntents.create({
          amount: Math.round(data.monto * 100), // Stripe usa centavos
          currency: 'usd',
          metadata: {
            nominaId: data.nominaId?.toString() || '',
            userId: user.id,
            userNombre: user.nombre,
            userRol: user.rol
          }
        });
        this.logger.log(`PaymentIntent creado: ${paymentIntent.id}`);
      }

      // Registrar el pago en la base de datos
      const pago = await this.prisma.pagar.create({
        data: {
          nominaId: data.nominaId,
          is_user: user.id,
          monto: data.monto,
          fecha: new Date(),
        }
      });

      // Obtener datos del trabajador para generar PDF
      const nomina = await this.prisma.nomina.findUnique({
        where: { id: data.nominaId },
        include: { trabajador: true }
      });

      let pdfPath = '';
      if (nomina && nomina.trabajador) {
        pdfPath = this.pdfService.generarEgresoPDF(pago, nomina.trabajador);
        this.logger.log(`PDF generado: ${pdfPath}`);
      }

      this.logger.log(`Pago creado: ${pago.id}`);
      return {
        success: true,
        pago,
        stripeClientSecret: paymentIntent?.client_secret || null,
        egresoPDF: pdfPath,
        mensaje: 'Pago creado exitosamente y PDF generado'
      };

    } catch (error) {
      this.logger.error(`Error creando pago: ${error.message}`);
      throw error;
    }
  }

  async confirmarPago(pagoId: number) {
    try {
      const pago = await this.prisma.pagar.findUnique({
        where: { id: pagoId },
        include: { nomina: { include: { trabajador: true } } }
      });

      if (!pago) {
        throw new Error(`Pago ${pagoId} no encontrado`);
      }

      // 🔧 ACTUALIZAR EL ESTADO A COMPLETADO
      const pagoActualizado = await this.prisma.pagar.update({
        where: { id: pagoId },
        data: {
          estado: 'COMPLETADO',
          fechaPago: new Date()
        },
        include: { nomina: { include: { trabajador: true } } }
      });

      this.logger.log(`✅ Pago ${pagoId} confirmado - Estado actualizado a COMPLETADO`);

      // Generar PDF de egreso
      let pdfPath = '';
      if (pagoActualizado.nomina && pagoActualizado.nomina.trabajador) {
        pdfPath = this.pdfService.generarEgresoPDF(pagoActualizado, pagoActualizado.nomina.trabajador);
        this.logger.log(`PDF generado: ${pdfPath}`);
      }

      return {
        success: true,
        pago: pagoActualizado,
        pagoId,
        egresoPDF: pdfPath,
        mensaje: 'Pago confirmado exitosamente - Estado actualizado a COMPLETADO'
      };

    } catch (error) {
      this.logger.error(`Error confirmando pago: ${error.message}`);
      throw error;
    }
  }

  async generarReporteEgresos() {
    try {
      const pagos = await this.prisma.pagar.findMany({
        include: { nomina: { include: { trabajador: true } } },
        orderBy: { fecha: 'desc' }
      });

      const pdfPath = this.pdfService.generarReporteEgresosPDF(pagos);
      
      return {
        success: true,
        reportePDF: pdfPath,
        totalPagos: pagos.length,
        montoTotal: pagos.reduce((sum, p) => sum + p.monto, 0),
        mensaje: 'Reporte de egresos generado'
      };
    } catch (error) {
      this.logger.error(`Error generando reporte: ${error.message}`);
      throw error;
    }
  }

  async generarReporteMensual(mes: number, anio: number) {
    try {
      const fechaInicio = new Date(anio, mes - 1, 1);
      const fechaFin = new Date(anio, mes, 0);

      const pagos = await this.prisma.pagar.findMany({
        where: {
          fecha: {
            gte: fechaInicio,
            lte: fechaFin
          }
        },
        include: { nomina: { include: { trabajador: true } } },
        orderBy: { fecha: 'desc' }
      });

      const pdfPath = this.pdfService.generarReporteMensualPDF(pagos, mes, anio);
      
      return {
        success: true,
        reportePDF: pdfPath,
        mes,
        anio,
        totalPagos: pagos.length,
        montoTotal: pagos.reduce((sum, p) => sum + p.monto, 0),
        mensaje: `Reporte mensual ${mes}/${anio} generado`
      };
    } catch (error) {
      this.logger.error(`Error generando reporte mensual: ${error.message}`);
      throw error;
    }
  }
}
