import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePropertyDto {
  @IsNotEmpty({ message: 'La torre es obligatoria' })
  @IsString()
  tower: string;

  @IsNotEmpty({ message: 'La unidad (apartamento/casa) es obligatoria' })
  @IsString()
  unit: string;

  @IsNotEmpty({ message: 'El tipo es obligatorio (apartamento, casa, local, oficina)' })
  @IsString()
  type: string;

  @IsNotEmpty({ message: 'El área es obligatoria' })
  @IsNumber({}, { message: 'El área debe ser un número decimal' })
  area: number;

  @IsNotEmpty({ message: 'El coeficiente es obligatorio' })
  @IsNumber({}, { message: 'El coeficiente debe ser un número decimal' })
  coefficient: number;

  @IsOptional()
  @IsString()
  ownerId?: string;
}
