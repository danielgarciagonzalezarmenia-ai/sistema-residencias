import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './prisma.module';
import { AuthModule } from './auth/auth.module';
import { ResidentsModule } from './residents/residents.module';
import { PropertiesModule } from './properties/properties.module';

@Module({
  imports: [PrismaModule, AuthModule, ResidentsModule, PropertiesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
