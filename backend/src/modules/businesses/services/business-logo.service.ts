import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import { Business } from '../entities/business.entity';
import {
  detectLogoFormat,
  logoVersion,
  MAX_LOGO_BYTES,
} from '../policies/logo-image.policy';
import { LogoStorage, type StoredLogo } from '../storage/logo-storage';

/**
 * El logo de cada negocio: lo valida, lo guarda en S3 con una llave nueva en
 * cada cambio (así la web nunca muestra uno viejo de caché) y borra el anterior.
 */
@Injectable()
export class BusinessLogoService {
  private readonly logger = new Logger(BusinessLogoService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly storage: LogoStorage,
  ) {}

  get enabled(): boolean {
    return this.storage.enabled;
  }

  /** Guarda el logo y devuelve su versión nueva. */
  async set(businessId: number, data: Buffer | undefined): Promise<string> {
    if (!data || data.length === 0)
      throw new BadRequestException('Elige una imagen para el logo');
    if (data.length > MAX_LOGO_BYTES)
      throw new PayloadTooLargeException('El logo debe pesar máximo 1 MB');
    const format = detectLogoFormat(data);
    if (!format)
      throw new BadRequestException(
        'El logo debe ser una imagen PNG, JPG o WebP',
      );

    const key = `logos/${businessId}/${randomBytes(8).toString('hex')}.${format.extension}`;
    await this.storage.put(key, data, format.contentType);
    const previous = await this.replaceKey(businessId, key);
    await this.deleteQuietly(previous);
    this.logger.log(`negocio ${businessId}: logo nuevo`);
    return logoVersion(key)!;
  }

  async remove(businessId: number): Promise<void> {
    const previous = await this.replaceKey(businessId, null);
    await this.deleteQuietly(previous);
  }

  /** El logo del negocio; 404 si no tiene. */
  async get(businessId: number): Promise<StoredLogo> {
    const business = await this.repo().findOneBy({ id: businessId });
    const logo = business?.logoKey
      ? await this.storage.get(business.logoKey)
      : null;
    if (!logo) throw new NotFoundException('El negocio no tiene logo');
    return logo;
  }

  /** Cambia la llave guardada y devuelve la anterior. */
  private async replaceKey(
    businessId: number,
    key: string | null,
  ): Promise<string | null> {
    const business = await this.repo().findOneByOrFail({ id: businessId });
    await this.repo().update({ id: businessId }, { logoKey: key });
    return business.logoKey;
  }

  /** Si falla, solo queda un archivo huérfano en el bucket: no es motivo para fallar. */
  private async deleteQuietly(key: string | null): Promise<void> {
    if (!key) return;
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.warn(`no se pudo borrar ${key}: ${(error as Error).message}`);
    }
  }

  private repo() {
    return this.dataSource.getRepository(Business);
  }
}
