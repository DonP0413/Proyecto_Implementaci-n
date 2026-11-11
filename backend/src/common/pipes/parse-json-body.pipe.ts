/**
 * Objetivo: permitir enviar JSON + archivos en una misma petición
 * multipart/form-data. El campo `data` contiene el JSON del DTO; este pipe lo
 * parsea, lo transforma a la clase DTO y lo valida con class-validator, con
 * las mismas reglas que el ValidationPipe global.
 */
import { BadRequestException, Injectable, PipeTransform, Type } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

const flatten = (errors: ValidationError[], parent = ''): string[] =>
  errors.flatMap((error) => {
    const property = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((msg) => `${property}: ${msg}`);
    return [...own, ...flatten(error.children ?? [], property)];
  });

/**
 * Uso recomendado en controladores: declarar el parámetro como `string`
 * (`@Body('data') data: string`) para que el ValidationPipe global no
 * intente validar el texto crudo, y luego `await parseJsonDto(Dto, data)`.
 */
export const parseJsonDto = <T extends object>(dtoClass: Type<T>, value: unknown): Promise<T> =>
  new ParseJsonBodyPipe(dtoClass).transform(value);

@Injectable()
export class ParseJsonBodyPipe<T extends object> implements PipeTransform<unknown, Promise<T>> {
  constructor(private readonly dtoClass: Type<T>) {}

  async transform(value: unknown): Promise<T> {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new BadRequestException('El campo "data" (JSON) es obligatorio');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new BadRequestException('El campo "data" no es un JSON válido');
    }
    const instance = plainToInstance(this.dtoClass, parsed);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length > 0) throw new BadRequestException(flatten(errors));
    return instance;
  }
}
