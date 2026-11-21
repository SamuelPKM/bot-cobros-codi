import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_TEXT_LENGTH } from '../constants/demo.constants';

export class DemoMessageDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Escribe un mensaje.' })
  @IsNotEmpty({ message: 'Escribe un mensaje.' })
  @MaxLength(MAX_TEXT_LENGTH, {
    message: `El mensaje puede tener hasta ${MAX_TEXT_LENGTH} caracteres.`,
  })
  text!: string;

  /** Último id que ya tiene la página: se devuelve todo lo posterior. */
  @IsOptional()
  @IsInt()
  @Min(0)
  after?: number;
}
