import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PagoMensualController } from './pago-mensual.controller';
import { PagoMensualService } from './pago-mensual.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [HttpModule],
  controllers: [PagoMensualController],
  providers: [PagoMensualService, PrismaService],
  exports: [PagoMensualService]
})
export class PagoMensualModule {}