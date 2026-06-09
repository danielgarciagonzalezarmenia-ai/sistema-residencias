import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateResidentDto } from './dto/create-resident.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';

@Injectable()
export class ResidentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, filters: { tower?: string; unit?: string; status?: string }) {
    const whereClause: any = { tenantId };

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.tower || filters.unit) {
      whereClause.properties = {
        some: {
          property: {
            ...(filters.tower && { tower: filters.tower }),
            ...(filters.unit && { unit: filters.unit }),
          },
        },
      };
    }

    return this.prisma.resident.findMany({
      where: whereClause,
      include: {
        properties: {
          include: {
            property: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    const resident = await this.prisma.resident.findFirst({
      where: { id, tenantId },
      include: {
        properties: {
          include: {
            property: true,
          },
        },
      },
    });

    if (!resident) {
      throw new NotFoundException('Residente no encontrado o no pertenece a su conjunto');
    }

    return resident;
  }

  async create(tenantId: string, createDto: CreateResidentDto) {
    const { propertyId, ...residentData } = createDto;

    // Crear residente dentro de una transacción para asociar el inmueble si se proporciona
    return this.prisma.$transaction(async (tx) => {
      const resident = await tx.resident.create({
        data: {
          ...residentData,
          tenantId,
        },
      });

      if (propertyId) {
        // Verificar que el inmueble pertenezca al mismo tenant
        const property = await tx.property.findFirst({
          where: { id: propertyId, tenantId },
        });

        if (!property) {
          throw new BadRequestException('El inmueble especificado no pertenece a este conjunto');
        }

        await tx.propertyResident.create({
          data: {
            propertyId,
            residentId: resident.id,
            isPrimary: true,
            type: 'TENANT',
          },
        });
      }

      return tx.resident.findUnique({
        where: { id: resident.id },
        include: {
          properties: {
            include: {
              property: true,
            },
          },
        },
      });
    });
  }

  async update(tenantId: string, id: string, updateDto: UpdateResidentDto) {
    // Validar existencia y pertenencia
    await this.findOne(tenantId, id);

    return this.prisma.resident.update({
      where: { id },
      data: updateDto,
      include: {
        properties: {
          include: {
            property: true,
          },
        },
      },
    });
  }

  async remove(tenantId: string, id: string) {
    // Eliminación lógica (desactivar residente)
    await this.findOne(tenantId, id);

    return this.prisma.resident.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }
}
