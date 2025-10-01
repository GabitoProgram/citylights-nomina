import { Controller, Get, Post, Body } from '@nestjs/common';
import { NominaService } from './nomina.service';

@Controller('nomina')
export class NominaController {
  constructor(private readonly nominaService: NominaService) {}

  @Get()
  findAll() {
    return this.nominaService.findAll();
  }

  @Post()
  create(@Body() data: any) {
    // Asegurar que is_user sea string para cumplir con el schema
    if (data.is_user !== undefined && typeof data.is_user !== 'string') {
      data.is_user = String(data.is_user);
    }
    
    console.log('🔍 [NOMINA] Datos recibidos para crear nómina:', data);
    return this.nominaService.create(data);
  }
}
