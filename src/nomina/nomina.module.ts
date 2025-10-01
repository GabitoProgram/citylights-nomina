import { Module } from '@nestjs/common';
import { NominaService } from './nomina.service';
import { NominaController } from './nomina.controller';

@Module({
  providers: [NominaService],
  controllers: [NominaController],
})
export class NominaModule {}
