import { Module, forwardRef } from '@nestjs/common';
import { PagoMensualController } from './pago-mensual.controller';
import { PagoMensualService } from './pago-mensual.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [PagoMensualController],
  providers: [PagoMensualService, PrismaService],
  exports: [PagoMensualService]
})
export class PagoMensualModule {}