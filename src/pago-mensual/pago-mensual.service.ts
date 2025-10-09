import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import Stripe from 'stripe';

@Injectable()
export class PagoMensualService {
  private readonly logger = new Logger(PagoMensualService.name);
  private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private httpService: HttpService
  ) {
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
      
      // Crear fecha de gracia (5 días del mes siguiente)
      const fechaGracia = new Date(anio, mes, 5, 23, 59, 59);

      // Crear nueva cuota mensual
      const cuota = await this.prisma.cuotaMensualResidente.create({
        data: {
          userId,
          userName,
          userEmail,
          anio,
          mes,
          monto: 100.0, // Cuota base de $100
          montoMorosidad: 0.0,
          montoTotal: 100.0,
          estado: 'PENDIENTE',
          fechaVencimiento,
          fechaVencimientoGracia: fechaGracia,
          diasMorosidad: 0,
          porcentajeMorosidad: 10.0 // 10% de recargo por morosidad
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

      // Verificar si Stripe está configurado
      if (!this.stripe) {
        this.logger.warn('⚠️ Stripe no configurado, retornando solo la cuota');
        return {
          success: true,
          message: 'Cuota creada exitosamente (sin integración de pago)',
          cuota: {
            id: cuota.id,
            monto: cuota.monto,
            montoTotal: cuota.montoTotal,
            mes: cuota.mes,
            anio: cuota.anio,
            fechaVencimiento: cuota.fechaVencimiento,
            estado: cuota.estado
          }
        };
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
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/mis-pagos?success=true&cuota_id=${cuota.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/mis-pagos?canceled=true&cuota_id=${cuota.id}`,
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
          montoTotal: cuota.montoTotal,
          mes: cuota.mes,
          anio: cuota.anio,
          fechaVencimiento: cuota.fechaVencimiento
        }
      };

    } catch (error) {
      this.logger.error(`❌ Error creando sesión de pago: ${error.message}`);
      this.logger.error(`📋 Stack trace: ${error.stack}`);
      throw error;
    }
  }

  /**
   * 🤖 AUTOMATICO: Generar cuotas mensuales para todos los residentes USER_CASUAL
   */
  async generarCuotasMensualesAutomaticas() {
    try {
      const fecha = new Date();
      const anio = fecha.getFullYear();
      const mes = fecha.getMonth() + 1;

      this.logger.log(`🤖 Generando cuotas automáticas para ${mes}/${anio}`);

      // Obtener todos los usuarios USER_CASUAL del microservicio de login
      const loginServiceUrl = 'https://citylights-login-production.up.railway.app';
      const endpoint = `${loginServiceUrl}/users/list?role=USER_CASUAL&page=1&limit=100`;
      
      this.logger.log(`🔗 Consultando usuarios en: ${endpoint}`);
      
      const response = await firstValueFrom(
        this.httpService.get(endpoint)
      );

      const usuarios = response.data?.data?.users || [];
      this.logger.log(`👥 Encontrados ${usuarios.length} residentes USER_CASUAL`);

      let cuotasCreadas = 0;
      let cuotasExistentes = 0;

      for (const usuario of usuarios) {
        try {
          // Verificar si ya existe cuota para este mes
          const verificacion = await this.verificarCuotaMensualResidente(usuario.id.toString(), anio, mes);
          
          if (!verificacion.existe) {
            // Crear cuota automáticamente
            await this.crearCuotaMensualResidente(usuario.id.toString(), `${usuario.firstName} ${usuario.lastName}`, usuario.email);
            cuotasCreadas++;
            this.logger.log(`✅ Cuota creada para ${usuario.firstName} ${usuario.lastName}`);
          } else {
            cuotasExistentes++;
            this.logger.log(`ℹ️ Cuota ya existe para ${usuario.firstName} ${usuario.lastName}`);
          }
        } catch (error) {
          this.logger.error(`❌ Error creando cuota para ${usuario.firstName} ${usuario.lastName}: ${error.message}`);
        }
      }

      const resultado = {
        anio,
        mes,
        totalUsuarios: usuarios.length,
        cuotasCreadas,
        cuotasExistentes,
        mensaje: `Proceso completado: ${cuotasCreadas} cuotas creadas, ${cuotasExistentes} ya existían`
      };

      this.logger.log(`🎯 Resultado: ${JSON.stringify(resultado)}`);
      return resultado;

    } catch (error) {
      this.logger.error(`❌ Error generando cuotas automáticas: ${error.message}`);
      this.logger.error(`❌ Stack trace: ${error.stack}`);
      
      if (error.response) {
        this.logger.error(`❌ Error de respuesta HTTP: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      
      throw new Error(`Error al generar cuotas automáticas: ${error.message}`);
    }
  }

  /**
   * 👤 RESIDENTE: Obtener cuotas pendientes de un residente específico
   */
  async obtenerCuotasResidente(userId: string) {
    try {
      this.logger.log(`👤 Obteniendo cuotas para residente ${userId}`);

      const cuotas = await this.prisma.cuotaMensualResidente.findMany({
        where: { userId },
        orderBy: [
          { anio: 'desc' },
          { mes: 'desc' }
        ]
      });

      // Verificar y aplicar morosidad a las cuotas pendientes
      for (const cuota of cuotas) {
        if (cuota.estado === 'PENDIENTE') {
          await this.verificarYAplicarMorosidad();
        }
      }

      // Obtener las cuotas actualizadas
      const cuotasActualizadas = await this.prisma.cuotaMensualResidente.findMany({
        where: { userId },
        orderBy: [
          { anio: 'desc' },
          { mes: 'desc' }
        ]
      });

      const estadisticas = {
        total: cuotasActualizadas.length,
        pendientes: cuotasActualizadas.filter(c => c.estado === 'PENDIENTE').length,
        pagadas: cuotasActualizadas.filter(c => c.estado === 'PAGADO').length,
        morosas: cuotasActualizadas.filter(c => c.estado === 'MOROSO').length,
        montoTotalPendiente: cuotasActualizadas
          .filter(c => c.estado === 'PENDIENTE' || c.estado === 'MOROSO')
          .reduce((total, c) => total + c.montoTotal, 0)
      };

      return {
        cuotas: cuotasActualizadas,
        estadisticas
      };

    } catch (error) {
      this.logger.error(`❌ Error obteniendo cuotas del residente: ${error.message}`);
      throw error;
    }
  }
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

  /**
   * Confirmar pago de cuota mensual vía webhook de Stripe
   */
  async confirmarPagoCuotaResidente(sessionId: string) {
    try {
      this.logger.log(`✅ Confirmando pago de cuota con session: ${sessionId}`);

      // Buscar la cuota por session ID
      const cuota = await this.prisma.cuotaMensualResidente.findFirst({
        where: { stripeSessionId: sessionId }
      });

      if (!cuota) {
        throw new BadRequestException('Cuota no encontrada para esta sesión');
      }

      if (cuota.estado === 'PAGADO') {
        this.logger.log(`⚠️ Cuota ${cuota.id} ya estaba marcada como pagada`);
        return { success: true, cuota, yaEstabaPageada: true };
      }

      // Actualizar estado de la cuota
      const cuotaActualizada = await this.prisma.cuotaMensualResidente.update({
        where: { id: cuota.id },
        data: {
          estado: 'PAGADO',
          fechaPago: new Date(),
          metodoPago: 'STRIPE'
        }
      });

      this.logger.log(`✅ Cuota ${cuota.id} marcada como pagada exitosamente`);

      return {
        success: true,
        cuota: cuotaActualizada,
        yaEstabaPageada: false
      };

    } catch (error) {
      this.logger.error(`❌ Error confirmando pago: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verificar y aplicar morosidad a cuotas vencidas
   */
  async verificarYAplicarMorosidad() {
    try {
      const fechaActual = new Date();
      console.log(`🔍 Verificando morosidad - Fecha actual: ${fechaActual.toLocaleDateString()}`);

      // Buscar cuotas vencidas que no han sido pagadas
      const cuotasVencidas = await this.prisma.cuotaMensualResidente.findMany({
        where: {
          estado: {
            in: ['PENDIENTE', 'VENCIDO']
          },
          fechaVencimientoGracia: {
            lt: fechaActual // Vencidas después del período de gracia
          }
        }
      });

      console.log(`📋 Encontradas ${cuotasVencidas.length} cuotas vencidas`);

      const resultados = [];

      for (const cuota of cuotasVencidas) {
        try {
          // Calcular días de morosidad
          const diasMorosidad = Math.floor(
            (fechaActual.getTime() - cuota.fechaVencimientoGracia.getTime()) / (1000 * 60 * 60 * 24)
          );

          // Solo aplicar morosidad si hay días de retraso
          if (diasMorosidad > 0) {
            // Calcular recargo por morosidad
            const montoMorosidad = (cuota.monto * cuota.porcentajeMorosidad) / 100;
            const montoTotal = cuota.monto + montoMorosidad;

            // Actualizar la cuota con la morosidad
            const cuotaActualizada = await this.prisma.cuotaMensualResidente.update({
              where: { id: cuota.id },
              data: {
                estado: 'MOROSO',
                diasMorosidad: diasMorosidad,
                montoMorosidad: montoMorosidad,
                montoTotal: montoTotal
              }
            });

            resultados.push({
              userId: cuota.userId,
              userName: cuota.userName,
              mes: cuota.mes,
              anio: cuota.anio,
              diasMorosidad: diasMorosidad,
              montoOriginal: cuota.monto,
              montoMorosidad: montoMorosidad,
              montoTotal: montoTotal,
              porcentajeRecargo: cuota.porcentajeMorosidad,
              estado: 'MOROSO'
            });

            console.log(`💰 Morosidad aplicada a ${cuota.userName}: +$${montoMorosidad.toFixed(2)} (${diasMorosidad} días de retraso)`);
          }
        } catch (error) {
          console.error(`❌ Error aplicando morosidad a cuota ${cuota.id}:`, error.message);
          resultados.push({
            userId: cuota.userId,
            userName: cuota.userName,
            error: error.message
          });
        }
      }

      return {
        mensaje: `Verificación de morosidad completada`,
        cuotasVerificadas: cuotasVencidas.length,
        morosidadAplicada: resultados.filter(r => !r.error).length,
        errores: resultados.filter(r => r.error).length,
        detalles: resultados
      };

    } catch (error) {
      console.error('❌ Error verificando morosidad:', error);
      throw new Error(`Error verificando morosidad: ${error.message}`);
    }
  }

  /**
   * Obtener resumen de cuotas con morosidad
   */
  async obtenerResumenMorosidad() {
    try {
      const cuotasMorosas = await this.prisma.cuotaMensualResidente.findMany({
        where: {
          estado: 'MOROSO'
        },
        orderBy: [
          { anio: 'desc' },
          { mes: 'desc' },
          { diasMorosidad: 'desc' }
        ]
      });

      const resumen = {
        totalCuotasMorosas: cuotasMorosas.length,
        montoTotalMorosidad: cuotasMorosas.reduce((sum, cuota) => sum + cuota.montoMorosidad, 0),
        montoTotalAPagar: cuotasMorosas.reduce((sum, cuota) => sum + cuota.montoTotal, 0),
        promedioeDiasMorosidad: cuotasMorosas.length > 0 
          ? Math.round(cuotasMorosas.reduce((sum, cuota) => sum + cuota.diasMorosidad, 0) / cuotasMorosas.length)
          : 0,
        cuotasPorMes: cuotasMorosas.reduce((acc, cuota) => {
          const clave = `${cuota.mes}/${cuota.anio}`;
          if (!acc[clave]) acc[clave] = 0;
          acc[clave]++;
          return acc;
        }, {}),
        detallesCuotas: cuotasMorosas
      };

      return resumen;

    } catch (error) {
      console.error('❌ Error obteniendo resumen de morosidad:', error);
      throw new Error(`Error obteniendo resumen de morosidad: ${error.message}`);
    }
  }

  /**
   * Obtener estado de pago de todos los residentes USER_CASUAL para el mes actual
   */
  async obtenerEstadoPagoResidentesMesActual() {
    try {
      const fechaActual = new Date();
      const anio = fechaActual.getFullYear();
      const mes = fechaActual.getMonth() + 1;

      console.log(`👥 Obteniendo estado de pago de residentes para ${mes}/${anio}`);

      // Lista de residentes USER_CASUAL (simulados por ahora)
      // En producción, esto debería obtenerse del microservicio de login
      const residentes = [
        { userId: 'user1', userName: 'Juan Pérez', userEmail: 'juan@example.com' },
        { userId: 'user2', userName: 'María García', userEmail: 'maria@example.com' },
        { userId: 'user3', userName: 'Carlos López', userEmail: 'carlos@example.com' },
        { userId: 'user4', userName: 'Ana Martínez', userEmail: 'ana@example.com' },
        { userId: 'user5', userName: 'Pedro Rodríguez', userEmail: 'pedro@example.com' }
      ];

      const resultados = [];

      for (const residente of residentes) {
        try {
          // Buscar cuota del mes actual para este residente
          const cuotaMesActual = await this.prisma.cuotaMensualResidente.findUnique({
            where: {
              userId_anio_mes: {
                userId: residente.userId,
                anio: anio,
                mes: mes
              }
            }
          });

          if (cuotaMesActual) {
            // Si existe la cuota, mostrar su estado
            resultados.push({
              userId: residente.userId,
              userName: residente.userName,
              userEmail: residente.userEmail,
              tieneCuota: true,
              estado: cuotaMesActual.estado,
              monto: cuotaMesActual.monto,
              montoMorosidad: cuotaMesActual.montoMorosidad,
              montoTotal: cuotaMesActual.montoTotal,
              fechaVencimiento: cuotaMesActual.fechaVencimiento,
              fechaPago: cuotaMesActual.fechaPago,
              diasMorosidad: cuotaMesActual.diasMorosidad,
              cuotaId: cuotaMesActual.id
            });
          } else {
            // Si no existe cuota, mostrar como pendiente de crear
            resultados.push({
              userId: residente.userId,
              userName: residente.userName,
              userEmail: residente.userEmail,
              tieneCuota: false,
              estado: 'SIN_CUOTA',
              monto: 100.0,
              montoMorosidad: 0,
              montoTotal: 100.0,
              fechaVencimiento: null,
              fechaPago: null,
              diasMorosidad: 0,
              cuotaId: null
            });
          }
        } catch (error) {
          console.error(`❌ Error procesando residente ${residente.userName}:`, error.message);
          resultados.push({
            userId: residente.userId,
            userName: residente.userName,
            userEmail: residente.userEmail,
            tieneCuota: false,
            estado: 'ERROR',
            error: error.message
          });
        }
      }

      // Estadísticas del mes
      const estadisticas = {
        totalResidentes: resultados.length,
        conCuota: resultados.filter(r => r.tieneCuota).length,
        sinCuota: resultados.filter(r => !r.tieneCuota && r.estado === 'SIN_CUOTA').length,
        pagados: resultados.filter(r => r.estado === 'PAGADO').length,
        pendientes: resultados.filter(r => r.estado === 'PENDIENTE').length,
        vencidos: resultados.filter(r => r.estado === 'VENCIDO').length,
        morosos: resultados.filter(r => r.estado === 'MOROSO').length,
        montoTotalRecaudado: resultados
          .filter(r => r.estado === 'PAGADO')
          .reduce((sum, r) => sum + r.montoTotal, 0),
        montoTotalPendiente: resultados
          .filter(r => r.estado !== 'PAGADO' && r.estado !== 'ERROR')
          .reduce((sum, r) => sum + r.montoTotal, 0)
      };

      return {
        mes: mes,
        anio: anio,
        fechaConsulta: fechaActual,
        estadisticas: estadisticas,
        residentes: resultados
      };

    } catch (error) {
      console.error('❌ Error obteniendo estado de pago de residentes:', error);
      throw new Error(`Error obteniendo estado de pago: ${error.message}`);
    }
  }

  /**
   * � ESTADISTICAS: Obtener estadísticas generales del sistema
   */
  async obtenerEstadisticasGenerales() {
    try {
      const fechaActual = new Date();
      const anio = fechaActual.getFullYear();
      const mes = fechaActual.getMonth() + 1;

      this.logger.log(`📊 Generando estadísticas generales para ${mes}/${anio}`);

      // Obtener todas las cuotas del mes actual
      const cuotasMesActual = await this.prisma.cuotaMensualResidente.findMany({
        where: { anio, mes }
      });

      // Obtener total de usuarios USER_CASUAL
      const response = await firstValueFrom(
        this.httpService.get(`${process.env.LOGIN_SERVICE_URL || 'https://citylights-login-production.up.railway.app'}/users/list?role=USER_CASUAL&page=1&limit=100`)
      );
      const totalResidentes = response.data?.data?.total || 0;

      // Calcular estadísticas
      const estadisticas = {
        mesActual: {
          anio,
          mes,
          totalResidentes,
          cuotasGeneradas: cuotasMesActual.length,
          cuotasPendientes: cuotasMesActual.filter(c => c.estado === 'PENDIENTE').length,
          cuotasPagadas: cuotasMesActual.filter(c => c.estado === 'PAGADO').length,
          cuotasMorosas: cuotasMesActual.filter(c => c.estado === 'MOROSO').length,
          montoTotalGenerado: cuotasMesActual.reduce((total, c) => total + c.montoTotal, 0),
          montoTotalRecaudado: cuotasMesActual
            .filter(c => c.estado === 'PAGADO')
            .reduce((total, c) => total + c.montoTotal, 0),
          montoTotalPendiente: cuotasMesActual
            .filter(c => c.estado === 'PENDIENTE' || c.estado === 'MOROSO')
            .reduce((total, c) => total + c.montoTotal, 0)
        },
        cobertura: {
          porcentajeGeneracion: totalResidentes > 0 ? (cuotasMesActual.length / totalResidentes) * 100 : 0,
          porcentajePago: cuotasMesActual.length > 0 ? (cuotasMesActual.filter(c => c.estado === 'PAGADO').length / cuotasMesActual.length) * 100 : 0,
          porcentajeMorosidad: cuotasMesActual.length > 0 ? (cuotasMesActual.filter(c => c.estado === 'MOROSO').length / cuotasMesActual.length) * 100 : 0
        }
      };

      return {
        success: true,
        estadisticas,
        ultimaActualizacion: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error(`❌ Error obteniendo estadísticas generales: ${error.message}`);
      throw error;
    }
  }

  /**
   * �👥 RESIDENTES: Obtener usuarios USER_CASUAL desde el microservicio de login
   */
  async obtenerUsuariosCasual() {
    try {
      console.log('🔍 Consultando usuarios USER_CASUAL desde microservicio de login...');
      
      // Hacer llamada al microservicio de login a través del gateway usando HttpService
      const response = await firstValueFrom(
        this.httpService.get('https://citylights-gateway-production.up.railway.app/api/proxy/login/users?role=USER_CASUAL', {
          headers: {
            'Content-Type': 'application/json',
          }
        })
      );

      const usuarios = response.data;
      console.log(`✅ Obtenidos ${usuarios.length} usuarios USER_CASUAL`);
      
      return usuarios;

    } catch (error) {
      console.error('❌ Error obteniendo usuarios USER_CASUAL:', error);
      throw new Error(`Error conectando con microservicio de login: ${error.message}`);
    }
  }

  /**
   * 📊 RESIDENTES: Obtener resumen de pagos de todos los residentes del mes actual
   */
  async obtenerResumenPagosResidentes() {
    try {
      const fechaActual = new Date();
      const anio = fechaActual.getFullYear();
      const mes = fechaActual.getMonth() + 1;

      console.log(`📊 Obteniendo resumen de pagos de residentes para ${mes}/${anio}`);

      // 1. Obtener todos los usuarios USER_CASUAL del microservicio de login
      const usuarios = await this.obtenerUsuariosCasual();

      // 2. Para cada usuario, verificar si tiene cuota del mes actual
      const resumenResidentes = [];

      for (const usuario of usuarios) {
        try {
          // Buscar cuota del mes actual para este residente
          const cuotaMesActual = await this.prisma.cuotaMensualResidente.findUnique({
            where: {
              userId_anio_mes: {
                userId: usuario.id,
                anio: anio,
                mes: mes
              }
            }
          });

          const estadoPago = cuotaMesActual ? cuotaMesActual.estado : 'SIN_CUOTA';
          
          resumenResidentes.push({
            usuario: {
              id: usuario.id,
              name: usuario.name,
              email: usuario.email,
              role: usuario.role
            },
            cuota: cuotaMesActual,
            estadoPago: estadoPago,
            montoAPagar: cuotaMesActual ? cuotaMesActual.montoTotal : 100.0,
            tieneCuota: !!cuotaMesActual,
            esMoroso: cuotaMesActual?.estado === 'MOROSO',
            diasMorosidad: cuotaMesActual?.diasMorosidad || 0
          });

        } catch (error) {
          console.error(`❌ Error procesando usuario ${usuario.id}:`, error.message);
          resumenResidentes.push({
            usuario: {
              id: usuario.id,
              name: usuario.name,
              email: usuario.email,
              role: usuario.role
            },
            cuota: null,
            estadoPago: 'ERROR',
            montoAPagar: 100.0,
            tieneCuota: false,
            esMoroso: false,
            diasMorosidad: 0,
            error: error.message
          });
        }
      }

      // 3. Calcular estadísticas generales
      const estadisticas = {
        totalResidentes: resumenResidentes.length,
        conCuota: resumenResidentes.filter(r => r.tieneCuota).length,
        sinCuota: resumenResidentes.filter(r => !r.tieneCuota && r.estadoPago !== 'ERROR').length,
        pagados: resumenResidentes.filter(r => r.estadoPago === 'PAGADO').length,
        pendientes: resumenResidentes.filter(r => r.estadoPago === 'PENDIENTE').length,
        vencidos: resumenResidentes.filter(r => r.estadoPago === 'VENCIDO').length,
        morosos: resumenResidentes.filter(r => r.estadoPago === 'MOROSO').length,
        montoRecaudado: resumenResidentes
          .filter(r => r.estadoPago === 'PAGADO')
          .reduce((sum, r) => sum + r.montoAPagar, 0),
        montoPendiente: resumenResidentes
          .filter(r => r.estadoPago !== 'PAGADO' && r.estadoPago !== 'ERROR')
          .reduce((sum, r) => sum + r.montoAPagar, 0)
      };

      return {
        mes: mes,
        anio: anio,
        estadisticas: estadisticas,
        residentes: resumenResidentes
      };

    } catch (error) {
      console.error('❌ Error obteniendo resumen de pagos de residentes:', error);
      throw new Error(`Error obteniendo resumen de pagos: ${error.message}`);
    }
  }
}