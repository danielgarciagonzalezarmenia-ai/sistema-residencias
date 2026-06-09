import { Module } from '@nestjs/common';
import { ResidentsService } from './residents.service';
import { ResidentsController } from './residents.controller';

@Module({
  providers: [ResidentsService],
  controllers: [ResidentsController],
  exports: [ResidentsService],
})
export class ResidentsModule {}
