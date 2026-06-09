import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('properties')
export class PropertiesController {
  constructor(private propertiesService: PropertiesService) {}

  @Get()
  @Roles('ADMINISTRADOR', 'PORTERÍA', 'CONSEJO', 'CONTABILIDAD')
  async findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.propertiesService.findAll(tenantId);
  }

  @Get(':id')
  @Roles('ADMINISTRADOR', 'PORTERÍA', 'CONSEJO', 'CONTABILIDAD')
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.propertiesService.findOne(tenantId, id);
  }

  @Post()
  @Roles('ADMINISTRADOR')
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() createDto: CreatePropertyDto,
  ) {
    return this.propertiesService.create(tenantId, createDto);
  }
}
