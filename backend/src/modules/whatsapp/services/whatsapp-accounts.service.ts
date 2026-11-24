import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash, randomInt } from 'node:crypto';
import { DataSource } from 'typeorm';
import type { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/services/users.service';
import { LINK_CODE_TTL_MINUTES } from '../constants/whatsapp.constants';
import { phoneFromWaId } from '../policies/wa-phone.policy';

const hashCode = (code: string) =>
  createHash('sha256').update(code).digest('hex');

/** Qué WhatsApp tiene ligado cada persona y los códigos para ligarlo. */
@Injectable()
export class WhatsAppAccountsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly users: UsersService,
  ) {}

  /** El número ligado (10 dígitos) o null. */
  async phoneOf(userId: number): Promise<string | null> {
    const rows = await this.dataSource.query<{ phone: string }[]>(
      `SELECT phone FROM whatsapp_accounts WHERE user_id = $1`,
      [userId],
    );
    return rows[0]?.phone ?? null;
  }

  /** A dónde mandarle mensajes a una persona activa; null si no tiene WhatsApp ligado. */
  async waIdOf(userId: number): Promise<string | null> {
    const rows = await this.dataSource.query<{ wa_id: string }[]>(
      `SELECT a.wa_id FROM whatsapp_accounts a JOIN users u ON u.id = a.user_id
        WHERE a.user_id = $1 AND u.active`,
      [userId],
    );
    return rows[0]?.wa_id ?? null;
  }

  /** La persona activa que tiene ligado este número; null si nadie. */
  async findActiveUser(phone: string): Promise<User | null> {
    const rows = await this.dataSource.query<{ user_id: number }[]>(
      `SELECT user_id FROM whatsapp_accounts WHERE phone = $1`,
      [phone],
    );
    if (!rows[0]) return null;
    const user = await this.users.findById(rows[0].user_id);
    return user?.active ? user : null;
  }

  /** Código nuevo de 6 dígitos; reemplaza al anterior de la persona. */
  async createLinkCode(
    userId: number,
  ): Promise<{ code: string; expiresAt: Date }> {
    await this.dataSource.query(
      `DELETE FROM whatsapp_link_codes WHERE user_id = $1 OR expires_at <= now()`,
      [userId],
    );
    // Dos personas con el mismo código vigente es posible (1 en un millón): se elige otro.
    for (;;) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const rows = await this.dataSource.query<{ expires_at: Date }[]>(
        `INSERT INTO whatsapp_link_codes (user_id, code_hash, expires_at)
         VALUES ($1, $2, now() + make_interval(mins => $3))
         ON CONFLICT (code_hash) DO NOTHING
         RETURNING expires_at`,
        [userId, hashCode(code), LINK_CODE_TTL_MINUTES],
      );
      if (rows[0]) return { code, expiresAt: rows[0].expires_at };
    }
  }

  /**
   * Liga el número con un código vigente y lo gasta (un solo uso, aunque lleguen
   * dos mensajes a la vez). Si el número estaba con otra persona, pasa a esta.
   * @returns la persona, o null si el código no sirve o la persona está desactivada.
   */
  async link(code: string, waId: string): Promise<User | null> {
    const phone = phoneFromWaId(waId);
    if (!phone) return null;
    return this.dataSource.transaction(async (manager) => {
      // DELETE ... RETURNING devuelve [filas, cantidad].
      const claimed = await manager.query<[{ user_id: number }[], number]>(
        `DELETE FROM whatsapp_link_codes
          WHERE code_hash = $1 AND expires_at > now()
          RETURNING user_id`,
        [hashCode(code)],
      );
      const userId = claimed[0]?.[0]?.user_id;
      if (userId === undefined) return null;
      const user = await this.users.findById(userId);
      if (!user?.active) return null;
      await manager.query(
        `DELETE FROM whatsapp_accounts WHERE phone = $1 AND user_id <> $2`,
        [phone, userId],
      );
      await manager.query(
        `INSERT INTO whatsapp_accounts (user_id, wa_id, phone) VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE
           SET wa_id = EXCLUDED.wa_id, phone = EXCLUDED.phone, linked_at = now()`,
        [userId, waId, phone],
      );
      return user;
    });
  }

  async unlink(userId: number): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM whatsapp_accounts WHERE user_id = $1`,
      [userId],
    );
  }
}
