import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class PagoMensualService {
  private readonly logger = new Logger(PagoMensualService.name);
  private stripe: Stripe;

  constructor(private prisma: PrismaService) {
    // Inicializar Stripe
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      this.logger.error('❌ STRIPE_SECRET_KEY no está configurada');
      throw new Error('Configuración de Stripe faltante');
    }
    
    this.stripe = new Stripe(stripeSecretKey, { 
      apiVersion: '2022-11-15' 
    });
  }

  /**
   * 🏢 EMPLEADOS: Verificar si un empleado ya fue pagado este mes
   */
  async verificarPagoMensualEmpleado(trabajadorId: number, anio?: number, mes?: number) {
    const fecha = new Date();
    const anioActual = anio || fecha.getFullYear();
    const mesActual = mes || fecha.getMonth() + 1;

    const pagoExistente = await this.prisma.pagoMensualEmpleado.findUnique({
      where: {
        trabajadorId_anio_mes: {
          trabajadorId,
          anio: anioActual,
          mes: mesActual
        }
      }
    });

    return {
      yaPagado: !!pagoExistente,
      pagoExistente,
      anio: anioActual,
      mes: mesActual
    };
  }

  /**
   * 🏢 EMPLEADOS: Crear pago mensual para empleado (solo una vez por mes)
   */
  async crearPagoMensualEmpleado(trabajadorId: number, monto: number, userContext: any) {
    try {
      const fecha = new Date();
      const anio = fecha.getFullYear();
      const mes = fecha.getMonth() + 1;

      this.logger.log(`💰 Iniciando pago mensual para empleado ${trabajadorId} - ${anio}/${mes}`);

      // Verificar si ya fue pagado este mes
      const verificacion = await this.verificarPagoMensualEmpleado(trabajadorId, anio, mes);
      if (verificacion.yaPagado) {
        throw new ConflictException(
          `El empleado ya recibió su pago mensual para ${mes}/${anio}. ` +
          `Pago realizado el ${verificacion.pagoExistente.fechaPago.toLocaleDateString()}`
        );
      }

      // Obtener datos del trabajador
      const trabajador = await this.prisma.trabajador.findUnique({
        where: { id: trabajadorId }
      });

      if (!trabajador) {
        throw new BadRequestException('Trabajador no encontrado');
      }

      if (trabajador.estado !== 'ACTIVO') {
        throw new BadRequestException('No se puede pagar a un empleado inactivo');
      }

      // Crear el registro de pago mensual
      const pagoMensual = await this.prisma.pagoMensualEmpleado.create({
        data: {
          trabajadorId,
          anio,
          mes,
          monto,
          estado: 'COMPLETADO',
          is_user: userContext.userId || 'unknown',
          referencia: `PAY-${trabajadorId}-${anio}${mes.toString().padStart(2, '0')}-${Date.now()}`
        }
      });

      this.logger.log(`✅ Pago mensual creado exitosamente: ${pagoMensual.id}`);

      return {
        success: true,
        pagoMensual,
        mensaje: `Pago mensual de $${monto} registrado para ${trabajador.nombre} (${mes}/${anio})`
      };

    } catch (error) {
      this.logger.error(`❌ Error en pago mensual: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🏠 RESIDENTES: Verificar cuota mensual de residente
   */
  async verificarCuotaMensualResidente(userId: string, anio?: number, mes?: number) {
    const fecha = new Date();
    const anioActual = anio || fecha.getFullYear();
    const mesActual = mes || fecha.getMonth() + 1;

    const cuotaExistente = await this.prisma.cuotaMensualResidente.findUnique({
      where: {
        userId_anio_mes: {
          userId,
          anio: anioActual,
          mes: mesActual
        }
      }
    });

    return {
      existe: !!cuotaExistente,
      cuota: cuotaExistente,
      anio: anioActual,
      mes: mesActual
    };
  }

  /**
   * 🏠 RESIDENTES: Crear cuota mensual de $100 para residente
   */
  async crearCuotaMensualResidente(userId: string, userName: string, userEmail: string) {
    try {
      const fecha = new Date();
      const anio = fecha.getFullYear();
      const mes = fecha.getMonth() + 1;

      this.logger.log(`🏠 Creando cuota mensual para residente ${userId} - ${anio}/${mes}`);

      // Verificar si ya existe la cuota este mes
      const verificacion = await this.verificarCuotaMensualResidente(userId, anio, mes);
      if (verificacion.existe) {
        if (verificacion.cuota.estado === 'PAGADO') {
          throw new ConflictException(
            `La cuota mensual para ${mes}/${anio} ya fue pagada el ${verificacion.cuota.fechaPago?.toLocaleDateString()}`
          );
        } else {
          // Si existe pero no está pagada, retornar la cuota existente
          return {
            cuotaExistente: true,
            cuota: verificacion.cuota
          };
        }
      }

      // Crear fecha de vencimiento (último día del mes)
      const fechaVencimiento = new Date(anio, mes, 0, 23, 59, 59); // Último día del mes

      // Crear nueva cuota mensual
      const cuota = await this.prisma.cuotaMensualResidente.create({
        data: {
          userId,
          userName,
          userEmail,
          anio,
          mes,
          monto: 100.0, // Cuota fija de $100
          fechaVencimiento
        }
      });

      this.logger.log(`✅ Cuota mensual creada: ${cuota.id}`);

      return {
        cuotaExistente: false,
        cuota
      };

    } catch (error) {
      this.logger.error(`❌ Error creando cuota mensual: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🏠 RESIDENTES: Crear sesión de pago Stripe para cuota mensual
   */
  async crearSesionPagoCuotaResidente(userId: string, userName: string, userEmail: string) {
    try {
      this.logger.log(`💳 Creando sesión de pago para residente ${userId}`);

      // Crear o obtener cuota mensual
      const resultado = await this.crearCuotaMensualResidente(userId, userName, userEmail);
      const cuota = resultado.cuota;

      if (cuota.estado === 'PAGADO') {
        throw new ConflictException('La cuota mensual ya fue pagada');
      }

      // Crear sesión de Stripe
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Cuota Mensual - ${cuota.mes}/${cuota.anio}`,
              description: `Cuota mensual de mantenimiento para ${userName}`,
            },
            unit_amount: Math.round(cuota.monto * 100), // $100.00 = 10000 centavos
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/cuotas?success=true&cuota_id=${cuota.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/cuotas?canceled=true&cuota_id=${cuota.id}`,
        metadata: {
          cuota_id: cuota.id.toString(),
          user_id: userId,
          anio: cuota.anio.toString(),
          mes: cuota.mes.toString(),
          tipo: 'cuota_mensual_residente'
        }
      });

      // Actualizar cuota con session ID
      await this.prisma.cuotaMensualResidente.update({
        where: { id: cuota.id },
        data: { stripeSessionId: session.id }
      });

      this.logger.log(`🔗 Sesión de pago creada: ${session.url}`);

      return {
        success: true,
        session: {
          id: session.id,
          url: session.url
        },
        cuota: {
          id: cuota.id,
          monto: cuota.monto,
          mes: cuota.mes,
          anio: cuota.anio,
          fechaVencimiento: cuota.fechaVencimiento
        }
      };

    } catch (error) {
      this.logger.error(`❌ Error creando sesión de pago: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtener historial de pagos mensuales de empleados
   */
  async obtenerHistorialPagosEmpleados(anio?: number, mes?: number) {
    const where: any = {};
    
    if (anio) where.anio = anio;
    if (mes) where.mes = mes;

    return this.prisma.pagoMensualEmpleado.findMany({
      where,
      include: {
        trabajador: true
      },
      orderBy: [
        { anio: 'desc' },
        { mes: 'desc' },
        { fechaPago: 'desc' }
      ]
    });
  }

  /**
   * Obtener historial de cuotas de residentes
   */
  async obtenerHistorialCuotasResidentes(anio?: number, mes?: number, estado?: string) {
    const where: any = {};
    
    if (anio) where.anio = anio;
    if (mes) where.mes = mes;
    if (estado) where.estado = estado;

    return this.prisma.cuotaMensualResidente.findMany({
      where,
      orderBy: [
        { anio: 'desc' },
        { mes: 'desc' },
        { createdAt: 'desc' }
      ]
    });
  }
}