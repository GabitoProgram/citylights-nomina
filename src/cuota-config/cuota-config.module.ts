import { Module } from '@nestjs/common';
import { CuotaConfigController } from './cuota-config.controller';
import { CuotaConfigService } from './cuota-config.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [CuotaConfigController],
  providers: [CuotaConfigService, PrismaService],
  exports: [CuotaConfigService]
})
export class CuotaConfigModule {}