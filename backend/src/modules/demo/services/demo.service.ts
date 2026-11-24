import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, MoreThan } from 'typeorm';
import type { DemoConfig, Env } from '../../../config/env.validation';
import { BusinessesService } from '../../businesses/services/businesses.service';
import type { ConversationReply } from '../../conversations/interfaces/conversation.interfaces';
import { parseMessage } from '../../conversations/policies/command.parser';
import { texts } from '../../conversations/policies/conversation-texts';
import { ConversationService } from '../../conversations/services/conversation.service';
import type { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/services/users.service';
import {
  MESSAGES_PER_IP,
  MESSAGES_PER_SESSION,
  MESSAGES_WINDOW_MINUTES,
  SESSION_TTL_HOURS,
  SESSIONS_PER_IP_PER_HOUR,
} from '../constants/demo.constants';
import { DemoMessage } from '../entities/demo-message.entity';
import type { DemoInfo, DemoMessageView } from '../interfaces/demo.interfaces';
import { toDemoMessageView } from '../mappers/demo-message.mapper';
import { demoTexts } from '../policies/demo-texts';
import type { DemoSender } from '../types/demo.types';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const SESSION_ID = /^[a-f0-9]{32}$/;
/** Comandos que crean un cobro con pey (cuentan para el límite por hora). */
const CREATES_CHARGE = new Set(['qr', 'link']);

interface ActiveSession {
  hash: string;
  ipHash: string;
  user: User;
}

/**
 * Demo pública: la misma conversación de WhatsApp, por HTTP y sin cuenta.
 * Cada sesión tiene su propio vendedor desechable dentro del negocio de demo
 * (DEMO_BUSINESS_ID), así nadie ve ni confirma lo de otro. Los cobros son
 * reales con la API key de ese negocio, por eso todo tiene límites.
 * El "✅ Pagado" se agrega a la conversación cuando la web consulta.
 */
@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);
  private readonly config: DemoConfig | null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly businesses: BusinessesService,
    private readonly users: UsersService,
    private readonly conversation: ConversationService,
    config: ConfigService<Env, true>,
  ) {
    this.config = config.get('DEMO', { infer: true });
  }

  async info(): Promise<DemoInfo> {
    const { config, businessName } = await this.demo();
    return {
      businessName,
      maxAmount: config.maxAmountCents / 100,
      chargesPerHour: config.chargesPerHour,
    };
  }

  async createSession(
    ip: string,
  ): Promise<{ sessionId: string; messages: DemoMessageView[] }> {
    const { config, businessName } = await this.demo();
    const ipHash = sha256(ip);
    const [{ count }] = await this.dataSource.query<{ count: number }[]>(
      `SELECT count(*)::int AS count FROM demo_sessions
        WHERE ip_hash = $1 AND created_at > now() - interval '1 hour'`,
      [ipHash],
    );
    if (count >= SESSIONS_PER_IP_PER_HOUR)
      throw new HttpException(
        'Demasiadas sesiones nuevas desde esta conexión. Intenta en una hora.',
        HttpStatus.TOO_MANY_REQUESTS,
      );

    const visitor = await this.users.createDemoVisitor(
      config.businessId,
      config.maxAmountCents,
    );
    const sessionId = randomBytes(16).toString('hex');
    const hash = sha256(sessionId);
    await this.dataSource.query(
      `INSERT INTO demo_sessions (id_hash, user_id, ip_hash) VALUES ($1, $2, $3)`,
      [hash, visitor.id, ipHash],
    );
    await this.add(hash, 'bot', {
      text: demoTexts.welcome(businessName, config.maxAmountCents),
    });
    return { sessionId, messages: await this.list(hash, 0) };
  }

  /** Mensajes con id mayor a `after`, incluido cualquier "✅ Pagado" nuevo. */
  async messages(
    sessionId: string | undefined,
    after: number,
  ): Promise<DemoMessageView[]> {
    const session = await this.session(sessionId);
    await this.announcePaid(session);
    return this.list(session.hash, after);
  }

  /**
   * Atiende un mensaje del visitante.
   * @returns lo nuevo desde `after`; sin `after`, solo lo que generó este mensaje.
   */
  async send(
    sessionId: string | undefined,
    text: string,
    after: number | undefined,
  ): Promise<DemoMessageView[]> {
    const session = await this.session(sessionId);
    await this.assertMessageRate(session);
    await this.announcePaid(session);
    const visitorMessageId = await this.add(session.hash, 'visitor', { text });

    for (const reply of await this.reply(session.user, text))
      await this.add(session.hash, 'bot', reply);
    return this.list(session.hash, after ?? visitorMessageId - 1);
  }

  private async reply(user: User, text: string): Promise<ConversationReply[]> {
    const { config } = await this.demo();
    try {
      // Sin push en la demo pública: cualquiera podría mandar una solicitud de
      // pago al celular de otra persona (cobro no solicitado, regla 7 del
      // hackatón). QR y liga solo los ve quien los pide.
      if (parseMessage(text).type === 'charge')
        return [{ text: demoTexts.pushDisabled() }];
      if (
        CREATES_CHARGE.has(parseMessage(text).type) &&
        (await this.chargesLastHour(user.id)) >= config.chargesPerHour
      )
        return [{ text: demoTexts.tooManyCharges(config.chargesPerHour) }];
      return await this.conversation.handle(user, text);
    } catch (error) {
      this.logger.error(
        `demo, vendedor ${user.id}: ${(error as Error).message}`,
      );
      return [{ text: demoTexts.somethingWrong() }];
    }
  }

  private async chargesLastHour(userId: number): Promise<number> {
    const [{ count }] = await this.dataSource.query<{ count: number }[]>(
      `SELECT count(*)::int AS count FROM charges
        WHERE seller_id = $1 AND created_at > now() - interval '1 hour'`,
      [userId],
    );
    return count;
  }

  private async assertMessageRate(session: ActiveSession): Promise<void> {
    const [{ bySession, byIp }] = await this.dataSource.query<
      { bySession: number; byIp: number }[]
    >(
      `SELECT count(*) FILTER (WHERE m.session_hash = $1)::int AS "bySession",
              count(*)::int AS "byIp"
         FROM demo_messages m JOIN demo_sessions s ON s.id_hash = m.session_hash
        WHERE s.ip_hash = $2 AND m.sender = 'visitor'
          AND m.created_at > now() - make_interval(mins => $3)`,
      [session.hash, session.ipHash, MESSAGES_WINDOW_MINUTES],
    );
    if (bySession >= MESSAGES_PER_SESSION || byIp >= MESSAGES_PER_IP)
      throw new HttpException(
        'Vas muy rápido. Espera unos minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }

  /**
   * Agrega "✅ Pagado" por cada cobro pagado de la sesión que aún no se anunció.
   * charge_id es único: dos consultas a la vez no lo anuncian dos veces.
   */
  private async announcePaid(session: ActiveSession): Promise<void> {
    const paid = await this.dataSource.query<
      {
        id: number;
        amount_cents: number;
        payer_phone: string | null;
        concept: string | null;
        tracking_key: string | null;
      }[]
    >(
      `SELECT c.id, c.amount_cents, c.payer_phone, c.concept, a.tracking_key
         FROM charges c LEFT JOIN payment_attempts a ON a.id = c.paid_attempt_id
        WHERE c.seller_id = $1 AND c.status = 'paid'
          AND NOT EXISTS (SELECT 1 FROM demo_messages m WHERE m.charge_id = c.id)
        ORDER BY c.paid_at, c.id`,
      [session.user.id],
    );
    for (const charge of paid) {
      await this.dataSource.query(
        `INSERT INTO demo_messages (session_hash, sender, text, charge_id)
         VALUES ($1, 'bot', $2, $3) ON CONFLICT (charge_id) DO NOTHING`,
        [
          session.hash,
          texts.paid(
            {
              amountCents: charge.amount_cents,
              payerPhone: charge.payer_phone,
              concept: charge.concept,
            },
            charge.tracking_key,
          ),
          charge.id,
        ],
      );
    }
  }

  private async session(sessionId: string | undefined): Promise<ActiveSession> {
    await this.demo();
    const invalid = new UnauthorizedException(
      'Sesión de demo inválida o vencida. Recarga la página.',
    );
    if (!sessionId || !SESSION_ID.test(sessionId)) throw invalid;
    const hash = sha256(sessionId);
    const rows = await this.dataSource.query<
      { user_id: number; ip_hash: string }[]
    >(
      `SELECT user_id, ip_hash FROM demo_sessions
        WHERE id_hash = $1 AND created_at > now() - make_interval(hours => $2)`,
      [hash, SESSION_TTL_HOURS],
    );
    const user = rows[0] && (await this.users.findById(rows[0].user_id));
    if (!user?.active) throw invalid;
    return { hash, ipHash: rows[0].ip_hash, user };
  }

  private async add(
    sessionHash: string,
    sender: DemoSender,
    { text, qrString, url }: ConversationReply,
  ): Promise<number> {
    const [{ id }] = await this.dataSource.query<{ id: number }[]>(
      `INSERT INTO demo_messages (session_hash, sender, text, qr_string, url)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [sessionHash, sender, text, qrString ?? null, url ?? null],
    );
    return id;
  }

  private async list(
    sessionHash: string,
    after: number,
  ): Promise<DemoMessageView[]> {
    const messages = await this.dataSource.getRepository(DemoMessage).find({
      where: { sessionHash, id: MoreThan(after) },
      order: { id: 'ASC' },
    });
    return messages.map(toDemoMessageView);
  }

  /** La demo encendida y su negocio; 404 si no hay demo. */
  private async demo(): Promise<{ config: DemoConfig; businessName: string }> {
    const unavailable = new NotFoundException('La demo no está disponible');
    if (!this.config) throw unavailable;
    try {
      const business = await this.businesses.getById(this.config.businessId);
      return { config: this.config, businessName: business.name };
    } catch {
      throw unavailable;
    }
  }
}
