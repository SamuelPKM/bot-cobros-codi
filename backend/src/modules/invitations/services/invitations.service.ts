import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import type { Env } from '../../../config/env.validation';
import { BusinessesService } from '../../businesses/services/businesses.service';
import type { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/services/users.service';
import type { Role } from '../../users/types/role.type';
import {
  INVITATION_FRONTEND_PATH,
  INVITATION_TOKEN_BYTES,
  INVITATION_TTL_DAYS,
} from '../constants/invitations.constants';
import type { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { Invitation } from '../entities/invitation.entity';
import type {
  CreatedInvitation,
  InvitationPreview,
} from '../interfaces/invitation.interfaces';

const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const UNUSABLE =
  'Esta invitación ya se usó, venció o fue revocada. Pide una nueva';

/** Dueño de las invitaciones: crear, listar, revocar y aceptar (una sola vez). */
@Injectable()
export class InvitationsService {
  private readonly frontendUrl: string;

  constructor(
    @InjectRepository(Invitation) private readonly repo: Repository<Invitation>,
    private readonly users: UsersService,
    private readonly businesses: BusinessesService,
    config: ConfigService<Env, true>,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', { infer: true }) ?? '';
  }

  async create(admin: User, role: Role = 'seller'): Promise<CreatedInvitation> {
    const token = randomBytes(INVITATION_TOKEN_BYTES).toString('base64url');
    const invitation = await this.repo.save(
      this.repo.create({
        businessId: admin.businessId,
        role,
        tokenHash: hashToken(token),
        createdBy: admin.id,
        expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000),
      }),
    );
    return {
      token,
      invitation: {
        id: invitation.id,
        role: invitation.role,
        expiresAt: invitation.expiresAt.toISOString(),
        url: `${this.frontendUrl}${INVITATION_FRONTEND_PATH}/${token}`,
      },
    };
  }

  /** Vigentes: sin aceptar, sin revocar y sin vencer. */
  listPending(businessId: number): Promise<Invitation[]> {
    return this.repo.find({
      where: {
        businessId,
        acceptedAt: IsNull(),
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { id: 'ASC' },
    });
  }

  async revoke(businessId: number, id: number): Promise<void> {
    const invitation = await this.repo.findOneBy({ id, businessId });
    if (!invitation) throw new NotFoundException('No existe esa invitación');
    if (!invitation.acceptedAt && !invitation.revokedAt) {
      await this.repo.update({ id }, { revokedAt: new Date() });
    }
  }

  async preview(token: string): Promise<InvitationPreview> {
    const invitation = await this.repo.findOneBy({
      tokenHash: hashToken(token),
    });
    if (!invitation) throw new NotFoundException('No existe esa invitación');
    if (!isUsable(invitation)) throw new GoneException(UNUSABLE);
    const business = await this.businesses.getById(invitation.businessId);
    return {
      businessName: business.name,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  /**
   * Crea la cuenta en el negocio con el rol de la invitación y la marca como
   * usada. El candado sobre la fila hace que dos aceptaciones simultáneas no
   * creen dos cuentas: la segunda espera y encuentra la invitación ya usada.
   */
  accept(token: string, dto: AcceptInvitationDto): Promise<User> {
    return this.repo.manager.transaction(async (manager) => {
      const invitation = await manager.findOne(Invitation, {
        where: { tokenHash: hashToken(token) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invitation) throw new NotFoundException('No existe esa invitación');
      if (!isUsable(invitation)) throw new GoneException(UNUSABLE);

      // Si el usuario ya existe, lanza 409 y la transacción deja la invitación intacta.
      const user = await this.users.create(
        {
          businessId: invitation.businessId,
          username: dto.username,
          name: dto.name,
          role: invitation.role,
          password: dto.password,
        },
        manager,
      );
      await manager.update(
        Invitation,
        { id: invitation.id },
        {
          acceptedAt: new Date(),
          acceptedUserId: user.id,
        },
      );
      return user;
    });
  }
}

const isUsable = (invitation: Invitation): boolean =>
  !invitation.acceptedAt &&
  !invitation.revokedAt &&
  invitation.expiresAt.getTime() > Date.now();
