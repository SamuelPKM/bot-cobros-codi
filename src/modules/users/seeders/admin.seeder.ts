import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.validation';
import { UsersService } from '../services/users.service';

/** Crea el primer admin desde ADMIN_USERNAME / ADMIN_PASSWORD si todavía no hay ninguno. */
@Injectable()
export class AdminSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeeder.name);

  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.run();
    } catch (error) {
      this.logger.error(
        `No se pudo crear el admin inicial (¿corriste las migraciones?): ${(error as Error).message}`,
      );
    }
  }

  async run(): Promise<void> {
    const username = this.config.get('ADMIN_USERNAME', { infer: true });
    const password = this.config.get('ADMIN_PASSWORD', { infer: true });
    if (!username || !password) return;
    if ((await this.users.countAdmins()) > 0) return;
    await this.users.create({
      username,
      name: 'Administrador',
      role: 'admin',
      password,
    });
    this.logger.log(`Admin inicial "${username}" creado`);
  }
}
