import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateResidentDto {
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString()
  firstName: string;

  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  @IsString()
  lastName: string;

  @IsNotEmpty({ message: 'El documento es obligatorio' })
  @IsString()
  document: string;

  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @IsEmail({}, { message: 'Debe ser un correo electrónico válido' })
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  propertyId?: string; // ID del inmueble para asociar opcionalmente de inmediato
}
