import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { FacturaNominaService } from '../factura/factura-nomina.service';

@Injectable()
export class PagoService {
  private readonly logger = new Logger(PagoService.name);
  private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private facturaNominaService: FacturaNominaService
  ) {
    // Verificar que la clave de Stripe esté configurada
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      this.logger.error('❌ STRIPE_SECRET_KEY no está configurada en las variables de entorno');
      throw new Error('Configuración de Stripe faltante');
    }
    
    this.logger.log('✅ Inicializando Stripe con clave del entorno');
    this.stripe = new Stripe(stripeSecretKey, { 
      apiVersion: '2022-11-15' 
    });
  }

  /**
   * Crear sesión de pago con Stripe para nómina de trabajador
   */
  async crearSesionPagoNomina(trabajadorId: number, nominaId: number, monto: number, userContext: any) {
    try {
      this.logger.log(`🔄 Iniciando creación de sesión de pago`);
      this.logger.log(`📊 Parámetros: trabajadorId=${trabajadorId}, nominaId=${nominaId}, monto=${monto}`);
      this.logger.log(`👤 Usuario: ${JSON.stringify(userContext)}`);

      // Obtener datos del trabajador y nómina
      const trabajador = await this.prisma.trabajador.findUnique({
        where: { id: trabajadorId }
      });

      const nomina = await this.prisma.nomina.findUnique({
        where: { id: nominaId },
        include: { trabajador: true }
      });

      this.logger.log(`👷 Trabajador encontrado: ${trabajador ? 'SÍ' : 'NO'}`);
      this.logger.log(`📋 Nómina encontrada: ${nomina ? 'SÍ' : 'NO'}`);

      if (!trabajador || !nomina) {
        throw new Error('Trabajador o nómina no encontrados');
      }

      // Crear registro de pago usando el esquema actual
      this.logger.log(`💾 Creando registro de pago en base de datos...`);
      const pago = await this.prisma.pagar.create({
        data: {
          nominaId,
          monto,
          is_user: userContext.userId || 'unknown'
        }
      });
      this.logger.log(`✅ Pago creado con ID: ${pago.id}`);

      // Crear sesión de Stripe
      this.logger.log(`💳 Creando sesión de Stripe...`);
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd', // Cambiar según necesidades
            product_data: {
              name: `Pago de Nómina - ${trabajador.nombre}`,
              description: `Pago de sueldo y extras para ${trabajador.nombre} (${trabajador.tipo})`,
              metadata: {
                trabajador_id: trabajadorId.toString(),
                nomina_id: nominaId.toString(),
                pago_id: pago.id.toString()
              }
            },
            unit_amount: Math.round(monto * 100), // Stripe maneja centavos
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pagos?success=true&pago_id=${pago.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pagos?canceled=true&pago_id=${pago.id}`,
        metadata: {
          pago_id: pago.id.toString(),
          nomina_id: nominaId.toString(),
          trabajador_id: trabajadorId.toString(),
          tipo: 'pago_nomina'
        }
      });

      // Guardar session_id en los comentarios por ahora (usaremos el esquema actual)
      // En una implementación real, guardaríamos esto en una tabla separada o campo adicional

      this.logger.log(`Sesión de pago creada para nómina ${nominaId}: ${session.id}`);
      this.logger.log(`🔗 URL de pago: ${session.url}`);

      return {
        pagoId: pago.id,
        sessionId: session.id,
        url: session.url,
        trabajador: trabajador.nombre,
        monto
      };

    } catch (error) {
      this.logger.error(`❌ Error creando sesión de pago: ${error.message}`);
      this.logger.error(`❌ Stack trace: ${error.stack}`);
      
      // Si es un error específico de Stripe, logearlo con más detalle
      if (error.type && error.type.startsWith('Stripe')) {
        this.logger.error(`❌ Error de Stripe tipo: ${error.type}`);
        this.logger.error(`❌ Código de error Stripe: ${error.code}`);
        this.logger.error(`❌ Parámetro con error: ${error.param}`);
      }
      
      throw error;
      throw error;
    }
  }

  /**
   * Confirmar pago después de éxito en Stripe
   */
  async confirmarPago(pagoId: number, sessionId: string) {
    try {
      // Verificar la sesión en Stripe
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== 'paid') {
        throw new Error('El pago no ha sido completado en Stripe');
      }

      // Actualizar el pago en la base de datos con el estado completado
      const pagoActualizado = await this.prisma.pagar.update({
        where: { id: pagoId },
        data: {
          estado: 'COMPLETADO',
          fechaPago: new Date(),
          referencia: sessionId
        },
        include: {
          nomina: {
            include: { trabajador: true }
          }
        }
      });

      this.logger.log(`✅ Pago ${pagoId} confirmado exitosamente`);

      // 🆕 GENERAR FACTURA AUTOMÁTICAMENTE
      try {
        const factura = await this.facturaNominaService.generarFacturaAutomatica(pagoId);
        this.logger.log(`✅ Factura ${factura.numeroFactura} generada automáticamente para pago ${pagoId}`);
        
        return {
          ...pagoActualizado,
          factura: factura
        };
      } catch (facturaError) {
        this.logger.error(`❌ Error generando factura para pago ${pagoId}: ${facturaError.message}`);
        // No fallar la confirmación del pago por error en factura
        return pagoActualizado;
      }

    } catch (error) {
      this.logger.error(`Error confirmando pago: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtener todos los pagos
   */
  async obtenerPagos() {
    return this.prisma.pagar.findMany({
      include: {
        nomina: {
          include: { trabajador: true }
        }
      },
      orderBy: { fecha: 'desc' }
    });
  }

  /**
   * Obtener pago por ID
   */
  async obtenerPagoPorId(id: number) {
    return this.prisma.pagar.findUnique({
      where: { id },
      include: {
        nomina: {
          include: { trabajador: true }
        }
      }
    });
  }
}