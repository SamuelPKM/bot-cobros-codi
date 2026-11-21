import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ROLE_VALUES, type Role } from '../../users/types/role.type';

/**
 * Invitación de un solo uso para sumarse al equipo de un negocio. Solo se
 * guarda el hash del token: la liga completa se ve una sola vez, al crearla.
 */
@Entity('invitations')
export class Invitation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'business_id', type: 'integer' })
  businessId!: number;

  /** Rol con el que entra quien la acepta. */
  @Column({ type: 'enum', enum: ROLE_VALUES, enumName: 'user_role' })
  role!: Role;

  /** sha256 del token, en hexadecimal. */
  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash!: string;

  @Column({ name: 'created_by', type: 'integer' })
  createdBy!: number;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'accepted_user_id', type: 'integer', nullable: true })
  acceptedUserId!: number | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
