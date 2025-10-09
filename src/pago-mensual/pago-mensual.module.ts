import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PagoMensualController } from './pago-mensual.controller';
import { PagoMensualService } from './pago-mensual.service';
import { PrismaService } from '../prisma/prisma.service';
import { FacturaNominaService } from '../factura/factura-nomina.service';

@Module({
  imports: [HttpModule],
  controllers: [PagoMensualController],
  providers: [PagoMensualService, PrismaService, FacturaNominaService],
  exports: [PagoMensualService]
})
export class PagoMensualModule {}