import {
  BadGatewayException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import type { Env } from '../../../config/env.validation';
import { centsToPesos } from '../../../shared/money/money';
import { BusinessesService } from '../../businesses/services/businesses.service';
import { PeyError } from '../../pey/errors/pey.error';
import type { PeyApi } from '../../pey/interfaces/pey-api.interface';
import type { User } from '../../users/entities/user.entity';
import {
  LINK_BACK_PATH,
  LINK_EXPIRATION_HOURS,
  LINK_SUCCESS_PATH,
  MAX_PUSHES_PER_PAYER_PER_HOUR,
  NUM_REF_MODULUS,
  PUSH_EXPIRATION_SECONDS,
  QR_EXPIRATION_SECONDS,
} from '../constants/charges.constants';
import { Charge } from '../entities/charge.entity';
import { PaymentAttempt } from '../entities/payment-attempt.entity';
import type {
  CreateChargeInput,
  ListChargesFilter,
} from '../interfaces/create-charge-input.interface';
import { payerConcept } from '../policies/payer-concept.policy';
import { peyErrorReason } from '../policies/pey-error-reason.policy';

/** Intentos que se pueden generar sin el teléfono del cliente. */
type ShownKind = 'qr' | 'link';

const UNKNOWN_REASON: Record<ShownKind, string> = {
  qr: 'No se pudo generar el QR. Intenta de nuevo.',
  link: 'No se pudo generar la liga de pago. Intenta de nuevo.',
};

/**
 * Dueño de las escrituras de cobros e intentos de pago.
 * Reglas clave:
 *  - Nunca se reintenta un POST a pey (no hay llave de idempotencia).
 *  - Cada llamada a pey lleva `metadata.chargeId`, para ligar el pago aunque
 *    se pierda la respuesta.
 *  - Todo se cobra con la API key y el nombre del negocio de quien cobra.
 */
@Injectable()
export class ChargesService {
  private readonly logger = new Logger(ChargesService.name);
  private readonly frontendUrl: string | undefined;

  constructor(
    private readonly dataSource: DataSource,
    private readonly businesses: BusinessesService,
    config: ConfigService<Env, true>,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', { infer: true });
  }

  /**
   * Crea el cobro con el método pedido: push al celular, QR o liga. Devuelve
   * también el intento creado (QR o liga) para mostrarlo de inmediato.
   */
  async createCharge(
    user: User,
    input: CreateChargeInput,
  ): Promise<{ charge: Charge; attempt: PaymentAttempt | null }> {
    if (input.method === 'push') {
      return {
        charge: await this.createPushCharge(user, input),
        attempt: null,
      };
    }
    assertWithinLimit(user, input.amountCents);
    const charge = await this.dataSource.getRepository(Charge).save({
      businessId: user.businessId,
      sellerId: user.id,
      payerPhone: input.payerPhone,
      amountCents: input.amountCents,
      concept: input.concept,
    });
    return this.show(user, charge.id, input.method);
  }

  /**
   * Crea el cobro y manda el push CoDi al celular del cliente, con la API key
   * y el nombre del negocio de quien cobra (admin o vendedor).
   */
  async createPushCharge(
    seller: User,
    input: CreateChargeInput,
  ): Promise<Charge> {
    const payerPhone = input.payerPhone;
    if (!payerPhone)
      throw new UnprocessableEntityException('Falta el celular del cliente');
    const { businessName, pey } = await this.businesses.paymentContext(
      seller.businessId,
    );
    assertWithinLimit(seller, input.amountCents);

    const { charge, attempt } = await this.dataSource.transaction(
      async (manager) => {
        // Serializa los cobros a un mismo celular para que el límite por hora no se pueda rebasar en paralelo.
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          payerPhone,
        ]);
        const recentPushes = await this.countRecentPushes(manager, payerPhone);
        if (recentPushes >= MAX_PUSHES_PER_PAYER_PER_HOUR) {
          throw new HttpException(
            `Ya se mandaron ${MAX_PUSHES_PER_PAYER_PER_HOUR} cobros a ese celular en la última hora. Muéstrale un QR o espera un poco.`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        const charge = await manager.save(
          manager.create(Charge, {
            businessId: seller.businessId,
            sellerId: seller.id,
            payerPhone,
            amountCents: input.amountCents,
            concept: input.concept,
          }),
        );
        const attempt = await manager.save(
          manager.create(PaymentAttempt, { chargeId: charge.id, kind: 'push' }),
        );
        return { charge, attempt };
      },
    );

    const expiresAt = new Date(Date.now() + PUSH_EXPIRATION_SECONDS * 1000);
    try {
      const { transactionId, codiId } = await pey.createPush({
        amount: centsToPesos(charge.amountCents),
        phoneNumber: payerPhone,
        concept: payerConcept(businessName, charge.concept),
        expiration: PUSH_EXPIRATION_SECONDS,
        numRef: numRef(charge.id),
        metadata: { chargeId: String(charge.id) },
      });
      await this.attempts().update(attempt.id, {
        status: 'pending',
        transactionId,
        codiId,
        expiresAt,
      });
    } catch (error) {
      await this.recordPushFailure(attempt.id, charge.id, expiresAt, error);
      if (!(error instanceof PeyError)) throw error;
    }

    return this.findWithDetails(charge.id);
  }

  /** Plan B: QR del mismo cobro. */
  showQr(user: User, chargeId: number) {
    return this.show(user, chargeId, 'qr');
  }

  /** Plan B: liga de pago del mismo cobro. */
  showLink(user: User, chargeId: number) {
    return this.show(user, chargeId, 'link');
  }

  /** Siempre dentro del negocio. Vendedor: solo los suyos. Admin: todos, o los de una persona. */
  list(user: User, filter: ListChargesFilter): Promise<Charge[]> {
    const query = this.dataSource
      .getRepository(Charge)
      .createQueryBuilder('charge')
      .leftJoinAndSelect('charge.seller', 'seller')
      .leftJoinAndSelect('charge.attempts', 'attempt')
      // Con take() + joins, TypeORM exige nombres de propiedad (createdAt), no de columna.
      .orderBy('charge.createdAt', 'DESC')
      .addOrderBy('charge.id', 'DESC')
      .take(filter.limit)
      .where('charge.business_id = :businessId', {
        businessId: user.businessId,
      });

    const sellerId = user.role === 'admin' ? filter.sellerId : user.id;
    if (sellerId !== undefined)
      query.andWhere('charge.seller_id = :sellerId', { sellerId });
    if (filter.status)
      query.andWhere('charge.status = :status', { status: filter.status });
    return query.getMany();
  }

  /** El último cobro pendiente que hizo esta persona en las últimas `hours` horas. */
  findLatestPending(user: User, hours: number): Promise<Charge | null> {
    return this.dataSource
      .getRepository(Charge)
      .createQueryBuilder('charge')
      .where('charge.business_id = :businessId', {
        businessId: user.businessId,
      })
      .andWhere('charge.seller_id = :sellerId', { sellerId: user.id })
      .andWhere(`charge.status = 'pending'`)
      .andWhere(`charge.created_at > now() - make_interval(hours => :hours)`, {
        hours,
      })
      .orderBy('charge.id', 'DESC')
      .getOne();
  }

  /** Un cobro que el usuario puede ver; 404 si es de otro vendedor u otro negocio. */
  async findVisible(user: User, chargeId: number): Promise<Charge> {
    const charge = await this.findWithDetails(chargeId).catch(() => null);
    if (
      !charge ||
      charge.businessId !== user.businessId ||
      !canSee(user, charge)
    ) {
      throw new NotFoundException('No existe ese cobro');
    }
    return charge;
  }

  /**
   * QR o liga de un cobro pendiente. Si ya hay uno vigente del mismo tipo
   * devuelve ese, para que no existan dos QR o dos ligas cobrables de la misma
   * venta. Un fallo no le llegó a nadie: se guarda el motivo y se puede reintentar.
   */
  private async show(
    user: User,
    chargeId: number,
    kind: ShownKind,
  ): Promise<{ charge: Charge; attempt: PaymentAttempt }> {
    const { businessName, pey } = await this.businesses.paymentContext(
      user.businessId,
    );
    if (kind === 'link') this.linkReturnUrls();

    const outcome = await this.dataSource.transaction(async (manager) => {
      const charge = await manager.findOne(Charge, {
        where: { id: chargeId, businessId: user.businessId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!charge || !canSee(user, charge))
        throw new NotFoundException('No existe ese cobro');
      if (charge.status !== 'pending')
        throw new ConflictException('Este cobro ya no está pendiente');

      const active = await manager
        .createQueryBuilder(PaymentAttempt, 'attempt')
        .where('attempt.charge_id = :chargeId', { chargeId })
        .andWhere('attempt.kind = :kind', { kind })
        .andWhere(`attempt.status = 'pending' AND attempt.expires_at > now()`)
        .orderBy('attempt.id', 'DESC')
        .getOne();
      if (active) return { attempt: active };

      const attempt = await manager.save(
        manager.create(PaymentAttempt, { chargeId, kind }),
      );
      try {
        Object.assign(
          attempt,
          await this.createAtPey(pey, kind, charge, businessName),
          { status: 'pending' },
        );
        return { attempt: await manager.save(attempt) };
      } catch (error) {
        if (!(error instanceof PeyError)) throw error;
        const reason = error.isOutcomeUnknown
          ? UNKNOWN_REASON[kind]
          : peyErrorReason(error);
        this.logPeyError(chargeId, kind === 'qr' ? 'el QR' : 'la liga', error);
        await manager.update(PaymentAttempt, attempt.id, {
          status: 'failed',
          error: reason,
        });
        return { failure: reason };
      }
    });

    if ('failure' in outcome) throw new BadGatewayException(outcome.failure);
    return {
      charge: await this.findWithDetails(chargeId),
      attempt: outcome.attempt,
    };
  }

  /** Crea el QR o la liga en pey y devuelve los campos del intento. */
  private async createAtPey(
    pey: PeyApi,
    kind: ShownKind,
    charge: Charge,
    businessName: string,
  ): Promise<Partial<PaymentAttempt>> {
    const amount = centsToPesos(charge.amountCents);
    const metadata = { chargeId: String(charge.id) };
    if (kind === 'qr') {
      const qr = await pey.createQr({
        amount,
        concept: payerConcept(businessName, charge.concept),
        expiration: QR_EXPIRATION_SECONDS,
        numRef: numRef(charge.id),
        metadata,
      });
      return {
        qrId: qr.id,
        qrString: qr.qrString,
        expiresAt: new Date(Date.now() + QR_EXPIRATION_SECONDS * 1000),
      };
    }
    const link = await pey.createPaymentLink({
      amount,
      ...this.linkReturnUrls(),
      clientReferenceId: `cobro-${charge.id}`,
      metadata,
    });
    return {
      linkId: link.id,
      linkUrl: link.url,
      expiresAt: new Date(Date.now() + LINK_EXPIRATION_HOURS * 3_600_000),
    };
  }

  /** Pantallas del frontend a las que pey regresa al cliente; pey exige HTTPS. */
  private linkReturnUrls(): { successUrl: string; backUrl: string } {
    if (!this.frontendUrl?.startsWith('https://')) {
      throw new ServiceUnavailableException(
        'La liga de pago no está disponible: falta configurar FRONTEND_URL con https',
      );
    }
    return {
      successUrl: `${this.frontendUrl}${LINK_SUCCESS_PATH}`,
      backUrl: `${this.frontendUrl}${LINK_BACK_PATH}`,
    };
  }

  private findWithDetails(chargeId: number): Promise<Charge> {
    return this.dataSource.getRepository(Charge).findOneOrFail({
      where: { id: chargeId },
      relations: { seller: true, attempts: true },
    });
  }

  private async countRecentPushes(
    manager: EntityManager,
    payerPhone: string,
  ): Promise<number> {
    const [{ count }] = await manager.query<{ count: string }[]>(
      `SELECT count(*) FROM payment_attempts a
         JOIN charges c ON c.id = a.charge_id
        WHERE c.payer_phone = $1 AND a.kind = 'push' AND a.status <> 'failed'
          AND a.created_at > now() - interval '1 hour'`,
      [payerPhone],
    );
    return Number(count);
  }

  /**
   * Rechazo de pey -> `failed` (no salió nada).
   * Timeout, red o error inesperado -> `unknown`: pudo haber salido, así que
   * conserva la expiración (el barrido lo revisará con pey) y no se reintenta.
   */
  private async recordPushFailure(
    attemptId: number,
    chargeId: number,
    expiresAt: Date,
    error: unknown,
  ): Promise<void> {
    const peyError = error instanceof PeyError ? error : null;
    if (peyError) this.logPeyError(chargeId, 'el push', peyError);
    else
      this.logger.error(
        `cobro ${chargeId}: error inesperado al mandar el push: ${(error as Error).message}`,
      );

    const unknown = !peyError || peyError.isOutcomeUnknown;
    await this.attempts().update(attemptId, {
      status: unknown ? 'unknown' : 'failed',
      expiresAt: unknown ? expiresAt : null,
      error: peyError
        ? peyErrorReason(peyError)
        : peyErrorReason(new PeyError('', { type: 'NETWORK_ERROR' })),
    });
  }

  private logPeyError(chargeId: number, what: string, error: PeyError): void {
    const requestId = error.requestId ? ` requestId=${error.requestId}` : '';
    this.logger.warn(
      `cobro ${chargeId}: falló ${what} (${error.type}): ${error.message}${requestId}`,
    );
  }

  private attempts() {
    return this.dataSource.getRepository(PaymentAttempt);
  }
}

/** El tope por cobro de la persona, si tiene uno. */
function assertWithinLimit(user: User, amountCents: number): void {
  if (user.maxAmountCents !== null && amountCents > user.maxAmountCents) {
    throw new UnprocessableEntityException(
      `Tu monto máximo por cobro es de $${centsToPesos(user.maxAmountCents).toFixed(2)}`,
    );
  }
}

/** Dentro del negocio: el admin ve todos los cobros; el vendedor, solo los suyos. */
const canSee = (user: User, charge: Charge): boolean =>
  user.role === 'admin' || charge.sellerId === user.id;

/** numRef de CoDi (hasta 7 dígitos) derivado del id del cobro. */
const numRef = (chargeId: number): string => String(chargeId % NUM_REF_MODULUS);
