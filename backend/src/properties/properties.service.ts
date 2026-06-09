import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';

@Injectable()
export class PropertiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.property.findMany({
      where: { tenantId },
      include: {
        owner: true,
        wallet: true,
        residents: {
          include: {
            resident: true,
          },
        },
      },
      orderBy: [
        { tower: 'asc' },
        { unit: 'asc' },
      ],
    });
  }

  async findOne(tenantId: string, id: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, tenantId },
      include: {
        owner: true,
        wallet: true,
        residents: {
          include: {
            resident: true,
          },
        },
      },
    });

    if (!property) {
      throw new NotFoundException('Inmueble no encontrado o no pertenece a su conjunto');
    }

    return property;
  }

  async create(tenantId: string, createDto: CreatePropertyDto) {
    const { ownerId, ...propertyData } = createDto;

    // Ejecutar en transacción para crear el inmueble y su wallet asociada
    return this.prisma.$transaction(async (tx) => {
      // Validar si el propietario existe si se provee
      if (ownerId) {
        const ownerExists = await tx.owner.findUnique({
          where: { id: ownerId },
        });
        if (!ownerExists) {
          throw new BadRequestException('El propietario especificado no existe');
        }
      }

      const property = await tx.property.create({
        data: {
          ...propertyData,
          tenantId,
          ownerId,
        },
      });

      // Crear la wallet asociada (Cartera)
      await tx.wallet.create({
        data: {
          propertyId: property.id,
          tenantId,
          balance: 0.0, // Inicia al día
        },
      });

      return tx.property.findUnique({
        where: { id: property.id },
        include: {
          owner: true,
          wallet: true,
        },
      });
    });
  }
}
