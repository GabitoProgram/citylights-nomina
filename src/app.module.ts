import { Module } from '@nestjs/common';
import { TrabajadorModule } from './trabajador/trabajador.module';
import { NominaModule } from './nomina/nomina.module';
import { PagarModule } from './pagar/pagar.module';
import { ReportesModule } from './reportes/reportes.module';
import { PagoMensualModule } from './pago-mensual/pago-mensual.module';
import { PagoController } from './pago/pago.controller';
import { PagoService } from './pago/pago.service';
import { PdfController } from './pdf/pdf.controller';
import { PdfService } from './pdf/pdf.service';
import { FacturaNominaController } from './factura/factura-nomina.controller';
import { FacturaNominaService } from './factura/factura-nomina.service';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [TrabajadorModule, NominaModule, PagarModule, ReportesModule, PagoMensualModule],
  controllers: [PagoController, PdfController, FacturaNominaController],
  providers: [
    PagoService, 
    PdfService, 
    FacturaNominaService, 
    PrismaService
  ],
})
export class AppModule {}
