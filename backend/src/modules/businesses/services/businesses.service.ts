import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import { SecretBox } from '../../../shared/security/secret-box';
import { PeyError } from '../../pey/errors/pey.error';
import type { PeyApi } from '../../pey/interfaces/pey-api.interface';
import { PeyClientFactory } from '../../pey/services/pey-client.factory';
import type { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/services/users.service';
import {
  BUSINESS_SECRET_BOX,
  WEBHOOK_SLUG_BYTES,
} from '../constants/businesses.constants';
import { Business } from '../entities/business.entity';
import type {
  BusinessPaymentContext,
  RegisterBusinessInput,
  UpdateBusinessInput,
  WebhookTarget,
} from '../interfaces/business.interfaces';

const INVALID_KEY =
  'La API key de pey no es válida. Revísala en portal.mipey.mx > Desarrollador';
const PEY_UNAVAILABLE =
  'No pudimos validar tu API key con pey. Intenta de nuevo en unos minutos';

/**
 * Dueño de los negocios y de sus credenciales de pey. Las credenciales se
 * guardan cifradas y solo se abren aquí para armar el cliente de pey del negocio.
 */
@Injectable()
export class BusinessesService {
  private readonly logger = new Logger(BusinessesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly peyFactory: PeyClientFactory,
    @Inject(BUSINESS_SECRET_BOX) private readonly box: SecretBox,
  ) {}

  /**
   * Registra el negocio con su admin. La API key se valida con pey ANTES de
   * guardar nada; negocio y admin se crean en una sola transacción.
   */
  async register(
    input: RegisterBusinessInput,
  ): Promise<{ business: Business; admin: User }> {
    await this.assertValidApiKey(input.peyApiKey);
    return this.dataSource.transaction(async (manager) => {
      const business = await manager.save(
        manager.create(Business, {
          name: input.businessName.trim(),
          ...this.sealApiKey(input.peyApiKey),
          peyWebhookSecretSealed: null,
          webhookSlug: randomBytes(WEBHOOK_SLUG_BYTES).toString('base64url'),
        }),
      );
      const admin = await this.users.create(
        {
          businessId: business.id,
          username: input.username,
          name: input.adminName,
          role: 'admin',
          password: input.password,
        },
        manager,
      );
      this.logger.log(
        `negocio ${business.id} registrado por ${admin.username}`,
      );
      return { business, admin };
    });
  }

  async update(
    businessId: number,
    input: UpdateBusinessInput,
  ): Promise<Business> {
    const changes: Partial<Business> = {};
    if (input.name !== undefined) changes.name = input.name.trim();
    if (input.peyApiKey !== undefined) {
      await this.assertValidApiKey(input.peyApiKey);
      Object.assign(changes, this.sealApiKey(input.peyApiKey));
    }
    if (input.peyWebhookSecret !== undefined) {
      changes.peyWebhookSecretSealed = this.box.seal(input.peyWebhookSecret);
    }
    if (Object.keys(changes).length > 0) {
      await this.dataSource
        .getRepository(Business)
        .update({ id: businessId }, changes);
    }
    return this.getWithSecrets(businessId);
  }

  /** El negocio sin credenciales (nombre, slug…). */
  async getById(businessId: number): Promise<Business> {
    const business = await this.dataSource
      .getRepository(Business)
      .findOneBy({ id: businessId });
    if (!business) throw new NotFoundException('No existe ese negocio');
    return business;
  }

  /** El negocio con sus columnas cifradas (para saber si ya tiene secreto de webhook). */
  async getWithSecrets(businessId: number): Promise<Business> {
    const business = await this.query()
      .where('business.id = :businessId', { businessId })
      .getOne();
    if (!business) throw new NotFoundException('No existe ese negocio');
    return business;
  }

  /** Nombre y cliente de pey del negocio, para cobrar con SUS credenciales. */
  async paymentContext(businessId: number): Promise<BusinessPaymentContext> {
    const business = await this.getWithSecrets(businessId);
    return { businessName: business.name, pey: this.clientFor(business) };
  }

  /** Cliente de pey del negocio (webhooks y barrido). */
  async peyFor(businessId: number): Promise<PeyApi> {
    return this.clientFor(await this.getWithSecrets(businessId));
  }

  /** El negocio dueño de una URL de webhook, o null si el slug no existe. */
  async webhookTarget(slug: string): Promise<WebhookTarget | null> {
    const business = await this.query()
      .where('business.webhook_slug = :slug', { slug })
      .getOne();
    if (!business) return null;
    return {
      businessId: business.id,
      secret: business.peyWebhookSecretSealed
        ? this.box.open(business.peyWebhookSecretSealed)
        : null,
    };
  }

  private clientFor(business: Business): PeyApi {
    return this.peyFactory.create(this.box.open(business.peyApiKeySealed));
  }

  private query() {
    return this.dataSource
      .getRepository(Business)
      .createQueryBuilder('business')
      .addSelect([
        'business.peyApiKeySealed',
        'business.peyWebhookSecretSealed',
      ]);
  }

  private sealApiKey(
    apiKey: string,
  ): Pick<Business, 'peyApiKeySealed' | 'peyApiKeyLast4'> {
    return {
      peyApiKeySealed: this.box.seal(apiKey),
      peyApiKeyLast4: apiKey.slice(-4),
    };
  }

  /** 400 si pey no reconoce la key; 502 si pey no contestó (no se sabe). */
  private async assertValidApiKey(apiKey: string): Promise<void> {
    try {
      await this.peyFactory.create(apiKey).verifyApiKey();
    } catch (error) {
      if (
        error instanceof PeyError &&
        (error.status === 401 || error.status === 403)
      ) {
        throw new BadRequestException(INVALID_KEY);
      }
      this.logger.warn(
        `no se pudo validar una API key con pey: ${(error as Error).message}`,
      );
      throw new BadGatewayException(PEY_UNAVAILABLE);
    }
  }
}
