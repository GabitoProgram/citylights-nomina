import { IsString, IsBoolean, IsNotEmpty, IsOptional, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CrearConceptoDto {
  @IsString()
  @IsNotEmpty({ message: 'La clave del concepto es requerida' })
  @Matches(/^[a-z]+[a-zA-Z0-9]*$/, { 
    message: 'La clave debe empezar con letra minúscula y solo contener letras y números, sin espacios' 
  })
  @MaxLength(50, { message: 'La clave no puede tener más de 50 caracteres' })
  @Transform(({ value }) => value?.toLowerCase().replace(/\s+/g, ''))
  key: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre del concepto es requerido' })
  @MaxLength(100, { message: 'El nombre no puede tener más de 100 caracteres' })
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La descripción no puede tener más de 500 caracteres' })
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean = true;
}

export class ActualizarConceptoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre del concepto no puede estar vacío' })
  @MaxLength(100, { message: 'El nombre no puede tener más de 100 caracteres' })
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La descripción no puede tener más de 500 caracteres' })
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}