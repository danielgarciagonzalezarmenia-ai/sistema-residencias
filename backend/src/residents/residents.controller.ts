import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ResidentsService } from './residents.service';
import { CreateResidentDto } from './dto/create-resident.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('residents')
export class ResidentsController {
  constructor(private residentsService: ResidentsService) {}

  @Get()
  @Roles('ADMINISTRADOR', 'PORTERÍA', 'CONSEJO', 'CONTABILIDAD')
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('tower') tower?: string,
    @Query('unit') unit?: string,
    @Query('status') status?: string,
  ) {
    return this.residentsService.findAll(tenantId, { tower, unit, status });
  }

  @Get(':id')
  @Roles('ADMINISTRADOR', 'PORTERÍA', 'CONSEJO', 'CONTABILIDAD')
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.residentsService.findOne(tenantId, id);
  }

  @Post()
  @Roles('ADMINISTRADOR')
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() createDto: CreateResidentDto,
  ) {
    return this.residentsService.create(tenantId, createDto);
  }

  @Put(':id')
  @Roles('ADMINISTRADOR')
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateResidentDto,
  ) {
    return this.residentsService.update(tenantId, id, updateDto);
  }

  @Delete(':id')
  @Roles('ADMINISTRADOR')
  async remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.residentsService.remove(tenantId, id);
  }
}
