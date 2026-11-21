import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { hashPassword } from '../../../shared/security/password';
import { User } from '../entities/user.entity';
import type {
  CreateUserInput,
  UpdateUserInput,
} from '../interfaces/user-input.interface';
import type { Role } from '../types/role.type';

const UNIQUE_VIOLATION = '23505';

/** Dueño de las escrituras de usuarios: alta, edición y consultas. */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  findById(id: number): Promise<User | null> {
    return this.repo.findOneBy({ id });
  }

  /** Un usuario solo si es de ese negocio (para que un admin no toque a gente de otro). */
  findInBusiness(id: number, businessId: number): Promise<User | null> {
    return this.repo.findOneBy({ id, businessId });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.repo.findOneBy({ username: username.trim() });
  }

  /** Igual que findByUsername pero trae el hash, solo para el login. */
  findForLogin(username: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.username = :username', { username: username.trim() })
      .getOne();
  }

  list(filter: { businessId: number; role?: Role }): Promise<User[]> {
    return this.repo.find({
      where: {
        businessId: filter.businessId,
        ...(filter.role ? { role: filter.role } : {}),
      },
      order: { id: 'ASC' },
    });
  }

  /**
   * @param manager Para crear el usuario dentro de otra transacción (por
   *   ejemplo, el admin junto con su negocio).
   */
  async create(input: CreateUserInput, manager?: EntityManager): Promise<User> {
    const repo = manager ? manager.getRepository(User) : this.repo;
    try {
      const saved = await repo.save(
        repo.create({
          businessId: input.businessId,
          username: input.username.trim().toLowerCase(),
          name: input.name.trim(),
          role: input.role,
          passwordHash: await hashPassword(input.password),
          maxAmountCents: input.maxAmountCents ?? null,
        }),
      );
      return (await repo.findOneBy({ id: saved.id }))!;
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException('Ese usuario ya existe');
      }
      throw error;
    }
  }

  async update(id: number, input: UpdateUserInput): Promise<User> {
    const changes = await this.changesFor(input);
    if (Object.keys(changes).length > 0)
      await this.repo.update({ id }, changes);
    return (await this.findById(id))!;
  }

  /**
   * Edita a una persona del negocio sin dejarlo nunca sin un admin activo.
   * Bloquea las filas de los admins activos antes de contarlos: si dos admins
   * se quitan el rol a la vez, el segundo espera y ve el resultado del primero.
   */
  async updateInBusiness(
    businessId: number,
    id: number,
    input: UpdateUserInput,
  ): Promise<User> {
    const changes = await this.changesFor(input);
    return this.repo.manager.transaction(async (manager) => {
      const activeAdmins = (await manager.query(
        `SELECT id FROM users WHERE business_id = $1 AND role = 'admin' AND active FOR UPDATE`,
        [businessId],
      )) as { id: number }[];

      const target = await manager.findOneBy(User, { id, businessId });
      if (!target)
        throw new NotFoundException('No existe esa persona en tu negocio');

      const stopsBeingActiveAdmin =
        target.role === 'admin' &&
        target.active &&
        (input.role === 'seller' || input.active === false);
      if (
        stopsBeingActiveAdmin &&
        !activeAdmins.some((a) => a.id !== target.id)
      ) {
        throw new ConflictException(
          'El negocio necesita al menos un administrador activo',
        );
      }

      if (Object.keys(changes).length > 0)
        await manager.update(User, { id }, changes);
      return (await manager.findOneBy(User, { id }))!;
    });
  }

  private async changesFor(input: UpdateUserInput): Promise<Partial<User>> {
    const changes: Partial<User> = {};
    if (input.name !== undefined) changes.name = input.name.trim();
    if (input.role !== undefined) changes.role = input.role;
    if (input.active !== undefined) changes.active = input.active;
    if (input.maxAmountCents !== undefined)
      changes.maxAmountCents = input.maxAmountCents;
    if (input.password !== undefined)
      changes.passwordHash = await hashPassword(input.password);
    return changes;
  }
}
