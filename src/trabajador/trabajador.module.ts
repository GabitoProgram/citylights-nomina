import { Module } from '@nestjs/common';
import { TrabajadorService } from './trabajador.service';
import { TrabajadorController } from './trabajador.controller';

@Module({
  providers: [TrabajadorService],
  controllers: [TrabajadorController],
})
export class TrabajadorModule {}
