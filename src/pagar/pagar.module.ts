import { Module } from '@nestjs/common';
import { PagarService } from './pagar.service';
import { PagarController } from './pagar.controller';
import { PdfService } from './pdf.service';

@Module({
  providers: [PagarService, PdfService],
  controllers: [PagarController],
})
export class PagarModule {}
