import { Controller, Get, Post, Put, Delete, Body, Headers, Logger, Param } from '@nestjs/common';
import { TrabajadorService } from './trabajador.service';

@Controller('trabajador')
export class TrabajadorController {
  private readonly logger = new Logger(TrabajadorController.name);

  constructor(private readonly trabajadorService: TrabajadorService) {}

  @Get()
  findAll(@Headers() headers: any) {
    this.logger.log('🔍 Headers recibidos del gateway:', {
      userId: headers['x-user-id'],
      userName: headers['x-user-name'],
      userRole: headers['x-user-role'],
    });
    
    return this.trabajadorService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.trabajadorService.findOne(+id);
  }

  @Post()
  create(@Body() data: any, @Headers() headers: any) {
    this.logger.log('🔍 Headers recibidos del gateway:', {
      userId: headers['x-user-id'],
      userName: headers['x-user-name'],
      userRole: headers['x-user-role'],
    });
    
    this.logger.log('📝 Creando trabajador:', data);
    
    return this.trabajadorService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: any, @Headers() headers: any) {
    this.logger.log('🔍 Headers recibidos del gateway:', {
      userId: headers['x-user-id'],
      userName: headers['x-user-name'],
      userRole: headers['x-user-role'],
    });
    
    this.logger.log('📝 Actualizando trabajador:', { id: +id, data });
    
    return this.trabajadorService.update(+id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Headers() headers: any) {
    this.logger.log('🔍 Headers recibidos del gateway:', {
      userId: headers['x-user-id'],
      userName: headers['x-user-name'],
      userRole: headers['x-user-role'],
    });
    
    this.logger.log('🗑️ Eliminando trabajador:', { id: +id });
    
    return this.trabajadorService.remove(+id);
  }
}
