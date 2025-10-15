import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PagoMensualController } from './pago-mensual.controller';
import { PagoMensualService } from './pago-mensual.service';
import { PrismaService } from '../prisma/prisma.service';
import { FacturaNominaService } from '../factura/factura-nomina.service';
import { EmailModule } from '../email/email.module';
import { CuotaConfigService } from '../cuota-config/cuota-config.service';

@Module({
  imports: [HttpModule, EmailModule],
  controllers: [PagoMensualController],
  providers: [PagoMensualService, PrismaService, FacturaNominaService, CuotaConfigService],
  exports: [PagoMensualService]
})
export class PagoMensualModule {}