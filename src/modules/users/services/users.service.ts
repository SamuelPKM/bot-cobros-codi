import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
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

  list(filter: { role?: Role } = {}): Promise<User[]> {
    return this.repo.find({
      where: filter.role ? { role: filter.role } : {},
      order: { id: 'ASC' },
    });
  }

  countAdmins(): Promise<number> {
    return this.repo.countBy({ role: 'admin' });
  }

  async create(input: CreateUserInput): Promise<User> {
    try {
      const saved = await this.repo.save(
        this.repo.create({
          username: input.username.trim().toLowerCase(),
          name: input.name.trim(),
          role: input.role,
          passwordHash: await hashPassword(input.password),
          maxAmountCents: input.maxAmountCents ?? null,
        }),
      );
      return (await this.findById(saved.id))!;
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
    const changes: Partial<User> = {};
    if (input.name !== undefined) changes.name = input.name.trim();
    if (input.active !== undefined) changes.active = input.active;
    if (input.maxAmountCents !== undefined)
      changes.maxAmountCents = input.maxAmountCents;
    if (input.password !== undefined)
      changes.passwordHash = await hashPassword(input.password);
    if (Object.keys(changes).length > 0)
      await this.repo.update({ id }, changes);
    return (await this.findById(id))!;
  }
}
