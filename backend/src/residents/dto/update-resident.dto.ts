import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateResidentDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  document?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Debe ser un correo electrónico válido' })
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  status?: string; // ACTIVE, INACTIVE (para activar/desactivar/eliminar lógico)
}
