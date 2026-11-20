import {
  BadGatewayException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import type { Env } from '../../../config/env.validation';
import { centsToPesos } from '../../../shared/money/money';
import { PeyError } from '../../pey/errors/pey.error';
import { PeyClient } from '../../pey/services/pey-client.service';
import type { User } from '../../users/entities/user.entity';
import {
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

const QR_UNKNOWN_REASON = 'No se pudo generar el QR. Intenta de nuevo.';

/**
 * Dueño de las escrituras de cobros e intentos de pago.
 * Reglas clave:
 *  - Nunca se reintenta un POST a pey (no hay llave de idempotencia).
 *  - Cada llamada a pey lleva `metadata.chargeId`, para ligar el pago aunque
 *    se pierda la respuesta.
 */
@Injectable()
export class ChargesService {
  private readonly logger = new Logger(ChargesService.name);
  private readonly businessName: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly pey: PeyClient,
    config: ConfigService<Env, true>,
  ) {
    this.businessName = config.get('BUSINESS_NAME', { infer: true });
  }

  /** Crea el cobro y manda el push CoDi al celular del cliente. */
  async createPushCharge(
    seller: User,
    input: CreateChargeInput,
  ): Promise<Charge> {
    if (
      seller.maxAmountCents !== null &&
      input.amountCents > seller.maxAmountCents
    ) {
      throw new UnprocessableEntityException(
        `Tu monto máximo por cobro es de $${centsToPesos(seller.maxAmountCents).toFixed(2)}`,
      );
    }

    const { charge, attempt } = await this.dataSource.transaction(
      async (manager) => {
        // Serializa los cobros a un mismo celular para que el límite por hora no se pueda rebasar en paralelo.
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          input.payerPhone,
        ]);
        const recentPushes = await this.countRecentPushes(
          manager,
          input.payerPhone,
        );
        if (recentPushes >= MAX_PUSHES_PER_PAYER_PER_HOUR) {
          throw new HttpException(
            `Ya se mandaron ${MAX_PUSHES_PER_PAYER_PER_HOUR} cobros a ese celular en la última hora. Muéstrale un QR o espera un poco.`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        const charge = await manager.save(
          manager.create(Charge, {
            sellerId: seller.id,
            payerPhone: input.payerPhone,
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
      const { transactionId, codiId } = await this.pey.createPush({
        amount: centsToPesos(charge.amountCents),
        phoneNumber: charge.payerPhone,
        concept: payerConcept(this.businessName, charge.concept),
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

  /**
   * Plan B: QR del mismo cobro. Si ya hay uno vigente devuelve ese, para que
   * no existan dos QR cobrables de la misma venta.
   */
  async showQr(
    seller: User,
    chargeId: number,
  ): Promise<{ charge: Charge; attempt: PaymentAttempt }> {
    const outcome = await this.dataSource.transaction(async (manager) => {
      const charge = await manager.findOne(Charge, {
        where: { id: chargeId, sellerId: seller.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!charge) throw new NotFoundException('No existe ese cobro');
      if (charge.status !== 'pending')
        throw new ConflictException('Este cobro ya no está pendiente');

      const active = await manager
        .createQueryBuilder(PaymentAttempt, 'attempt')
        .where('attempt.charge_id = :chargeId', { chargeId })
        .andWhere(
          `attempt.kind = 'qr' AND attempt.status = 'pending' AND attempt.expires_at > now()`,
        )
        .orderBy('attempt.id', 'DESC')
        .getOne();
      if (active) return { attempt: active };

      const attempt = await manager.save(
        manager.create(PaymentAttempt, { chargeId, kind: 'qr' }),
      );
      try {
        const qr = await this.pey.createQr({
          amount: centsToPesos(charge.amountCents),
          concept: payerConcept(this.businessName, charge.concept),
          expiration: QR_EXPIRATION_SECONDS,
          numRef: numRef(charge.id),
          metadata: { chargeId: String(charge.id) },
        });
        attempt.status = 'pending';
        attempt.qrId = qr.id;
        attempt.qrString = qr.qrString;
        attempt.expiresAt = new Date(Date.now() + QR_EXPIRATION_SECONDS * 1000);
        return { attempt: await manager.save(attempt) };
      } catch (error) {
        if (!(error instanceof PeyError)) throw error;
        // Un QR fallido no llegó a nadie: se guarda el motivo y se puede intentar otra vez.
        const reason = error.isOutcomeUnknown
          ? QR_UNKNOWN_REASON
          : peyErrorReason(error);
        this.logPeyError(chargeId, 'el QR', error);
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

  /** Vendedor: solo los suyos. Admin: todos, o los de un vendedor. Más reciente primero. */
  list(user: User, filter: ListChargesFilter): Promise<Charge[]> {
    const query = this.dataSource
      .getRepository(Charge)
      .createQueryBuilder('charge')
      .leftJoinAndSelect('charge.seller', 'seller')
      .leftJoinAndSelect('charge.attempts', 'attempt')
      // Con take() + joins, TypeORM exige nombres de propiedad (createdAt), no de columna.
      .orderBy('charge.createdAt', 'DESC')
      .addOrderBy('charge.id', 'DESC')
      .take(filter.limit);

    const sellerId = user.role === 'admin' ? filter.sellerId : user.id;
    if (sellerId !== undefined)
      query.andWhere('charge.seller_id = :sellerId', { sellerId });
    if (filter.status)
      query.andWhere('charge.status = :status', { status: filter.status });
    return query.getMany();
  }

  /** Un cobro que el usuario puede ver; 404 si es de otro vendedor. */
  async findVisible(user: User, chargeId: number): Promise<Charge> {
    const charge = await this.findWithDetails(chargeId).catch(() => null);
    if (!charge || (user.role !== 'admin' && charge.sellerId !== user.id)) {
      throw new NotFoundException('No existe ese cobro');
    }
    return charge;
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

/** numRef de CoDi (hasta 7 dígitos) derivado del id del cobro. */
const numRef = (chargeId: number): string => String(chargeId % NUM_REF_MODULUS);
