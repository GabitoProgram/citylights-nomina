import { Injectable, Logger } from '@nestjs/common';
import sgMail from '@sendgrid/mail';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    // Configurar SendGrid con la API key desde variables de entorno
    const apiKey = process.env.SENDGRID_API_KEY;
    
    if (!apiKey) {
      this.logger.error('❌ SENDGRID_API_KEY no encontrada en variables de entorno');
      throw new Error('SENDGRID_API_KEY es requerida');
    }
    
    sgMail.setApiKey(apiKey);
    this.logger.log('✅ SendGrid configurado correctamente en Nómina');
  }

  /**
   * Enviar email de confirmación de pago de cuota mensual
   */
  async enviarConfirmacionPagoCuota(datos: {
    emailDestino: string;
    nombreUsuario: string;
    numeroPago: string;
    mes: string;
    año: string;
    monto: number;
    metodoPago: string;
    fechaPago: string;
  }) {
    try {
      this.logger.log(`📧 Enviando confirmación de pago de cuota a: ${datos.emailDestino}`);

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Confirmación de Pago - CitiLights</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              max-width: 600px; 
              margin: 0 auto; 
              padding: 20px; 
            }
            .header { 
              background-color: #10b981; 
              color: white; 
              padding: 20px; 
              text-align: center; 
              border-radius: 8px 8px 0 0; 
            }
            .content { 
              background-color: #f9fafb; 
              padding: 30px; 
              border-radius: 0 0 8px 8px; 
            }
            .info-box { 
              background-color: white; 
              padding: 20px; 
              border-radius: 8px; 
              margin: 20px 0; 
              border-left: 4px solid #10b981; 
            }
            .amount { 
              font-size: 24px; 
              font-weight: bold; 
              color: #10b981; 
              text-align: center; 
              margin: 20px 0; 
            }
            .footer { 
              text-align: center; 
              margin-top: 30px; 
              font-size: 12px; 
              color: #6b7280; 
            }
            .highlight { 
              color: #10b981; 
              font-weight: bold; 
            }
            .success-badge {
              background-color: #10b981;
              color: white;
              padding: 8px 16px;
              border-radius: 20px;
              display: inline-block;
              font-weight: bold;
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>💰 CitiLights</h1>
            <h2>Pago Confirmado</h2>
            <div class="success-badge">✅ PAGADO</div>
          </div>
          
          <div class="content">
            <p>Estimado/a <strong>${datos.nombreUsuario}</strong>,</p>
            
            <p>¡Excelente! Tu pago de cuota mensual ha sido <span class="highlight">procesado exitosamente</span>.</p>
            
            <div class="amount">
              $${datos.monto.toFixed(2)} USD
            </div>
            
            <div class="info-box">
              <h3>💳 Detalles del Pago</h3>
              <p><strong>Número de Transacción:</strong> <span class="highlight">${datos.numeroPago}</span></p>
              <p><strong>Período:</strong> ${datos.mes} ${datos.año}</p>
              <p><strong>Monto Pagado:</strong> $${datos.monto.toFixed(2)} USD</p>
              <p><strong>Método de Pago:</strong> ${datos.metodoPago}</p>
              <p><strong>Fecha de Pago:</strong> ${datos.fechaPago}</p>
            </div>
            
            <div class="info-box">
              <h3>📋 Información Importante</h3>
              <ul>
                <li>Tu cuenta está al día hasta el próximo mes</li>
                <li>Puedes acceder a todas las áreas comunes sin restricciones</li>
                <li>Conserva este email como comprobante de pago</li>
                <li>Si necesitas una factura formal, puedes descargarla desde tu panel</li>
              </ul>
            </div>
            
            <div class="info-box">
              <h3>🏢 Próximos Pasos</h3>
              <p>Tu acceso a las instalaciones y servicios de CitiLights está garantizado para este período. Si tienes alguna pregunta, no dudes en contactarnos.</p>
            </div>
            
            <div class="footer">
              <p>Este email fue generado automáticamente por el sistema de CitiLights.</p>
              <p>Si no realizaste este pago, contacta inmediatamente con administración.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const msg = {
        to: datos.emailDestino,
        from: {
          email: process.env.EMAIL_FROM || 'gabrielcallisayadiaz@gmail.com',
          name: process.env.EMAIL_FROM_NAME || 'CitiLights Nómina'
        },
        subject: `✅ Pago Confirmado - ${datos.mes} ${datos.año} | CitiLights`,
        html: htmlContent,
        text: `
          Confirmación de Pago - CitiLights
          
          Estimado/a ${datos.nombreUsuario},
          
          Tu pago de cuota mensual ha sido procesado exitosamente.
          
          Detalles del Pago:
          - Número de Transacción: ${datos.numeroPago}
          - Período: ${datos.mes} ${datos.año}
          - Monto: $${datos.monto.toFixed(2)} USD
          - Método: ${datos.metodoPago}
          - Fecha: ${datos.fechaPago}
          
          ¡Gracias por tu pago puntual!
          
          Equipo CitiLights
        `
      };

      this.logger.log(`📧 Preparando email de pago para: ${datos.emailDestino}`);
      this.logger.log(`📧 Desde: ${typeof msg.from === 'object' ? msg.from.email : msg.from}`);
      this.logger.log(`📋 Asunto: ${msg.subject}`);
      
      await sgMail.send(msg);
      this.logger.log(`✅ Email de confirmación de pago enviado exitosamente a ${datos.emailDestino}`);
      
      return {
        success: true,
        message: 'Email de confirmación de pago enviado exitosamente'
      };

    } catch (error) {
      this.logger.error(`❌ Error enviando email de confirmación de pago: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enviar recordatorio de pago pendiente
   */
  async enviarRecordatorioPago(datos: {
    emailDestino: string;
    nombreUsuario: string;
    mesVencido: string;
    añoVencido: string;
    montoVencido: number;
    diasVencido: number;
  }) {
    try {
      this.logger.log(`📧 Enviando recordatorio de pago a: ${datos.emailDestino}`);

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Recordatorio de Pago - CitiLights</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              max-width: 600px; 
              margin: 0 auto; 
              padding: 20px; 
            }
            .header { 
              background-color: #f59e0b; 
              color: white; 
              padding: 20px; 
              text-align: center; 
              border-radius: 8px 8px 0 0; 
            }
            .content { 
              background-color: #f9fafb; 
              padding: 30px; 
              border-radius: 0 0 8px 8px; 
            }
            .warning-box { 
              background-color: #fef3c7; 
              padding: 20px; 
              border-radius: 8px; 
              margin: 20px 0; 
              border-left: 4px solid #f59e0b; 
            }
            .amount { 
              font-size: 24px; 
              font-weight: bold; 
              color: #f59e0b; 
              text-align: center; 
              margin: 20px 0; 
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>⚠️ CitiLights</h1>
            <h2>Recordatorio de Pago</h2>
          </div>
          
          <div class="content">
            <p>Estimado/a <strong>${datos.nombreUsuario}</strong>,</p>
            
            <p>Te recordamos que tienes un pago pendiente en tu cuenta de CitiLights.</p>
            
            <div class="amount">
              $${datos.montoVencido.toFixed(2)} USD
            </div>
            
            <div class="warning-box">
              <h3>📅 Información del Pago Pendiente</h3>
              <p><strong>Período Vencido:</strong> ${datos.mesVencido} ${datos.añoVencido}</p>
              <p><strong>Monto Adeudado:</strong> $${datos.montoVencido.toFixed(2)} USD</p>
              <p><strong>Días de Atraso:</strong> ${datos.diasVencido} días</p>
            </div>
            
            <p>Para evitar suspensión de servicios, te pedimos regularizar tu situación lo antes posible.</p>
          </div>
        </body>
        </html>
      `;

      const msg = {
        to: datos.emailDestino,
        from: {
          email: process.env.EMAIL_FROM || 'gabrielcallisayadiaz@gmail.com',
          name: process.env.EMAIL_FROM_NAME || 'CitiLights Nómina'
        },
        subject: `⚠️ Recordatorio de Pago - ${datos.mesVencido} ${datos.añoVencido} | CitiLights`,
        html: htmlContent,
        text: `
          Recordatorio de Pago - CitiLights
          
          Estimado/a ${datos.nombreUsuario},
          
          Tienes un pago pendiente:
          - Período: ${datos.mesVencido} ${datos.añoVencido}
          - Monto: $${datos.montoVencido.toFixed(2)} USD
          - Días de atraso: ${datos.diasVencido} días
          
          Por favor, regulariza tu situación lo antes posible.
          
          Equipo CitiLights
        `
      };

      await sgMail.send(msg);
      this.logger.log(`✅ Recordatorio de pago enviado exitosamente a ${datos.emailDestino}`);
      
      return {
        success: true,
        message: 'Recordatorio de pago enviado exitosamente'
      };

    } catch (error) {
      this.logger.error(`❌ Error enviando recordatorio de pago: ${error.message}`);
      throw error;
    }
  }
}