import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PushToken } from '../entities/push-token.entity';

/** Dispositivos registrados para recibir notificaciones. */
@Injectable()
export class PushTokensService {
  constructor(
    @InjectRepository(PushToken) private readonly repo: Repository<PushToken>,
  ) {}

  /** Si el dispositivo ya era de otro usuario, pasa al nuevo (alguien cambió de sesión). */
  async register(userId: number, token: string): Promise<void> {
    await this.repo.upsert({ token, userId }, ['token']);
  }

  /** Cerrar sesión: solo borra el token si es del usuario. */
  async unregister(userId: number, token: string): Promise<void> {
    await this.repo.delete({ token, userId });
  }

  async tokensFor(userIds: number[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const rows = await this.repo.find({
      where: { userId: In(userIds) },
      order: { token: 'ASC' },
    });
    return rows.map((row) => row.token);
  }

  async removeTokens(tokens: string[]): Promise<void> {
    if (tokens.length > 0) await this.repo.delete({ token: In(tokens) });
  }
}
