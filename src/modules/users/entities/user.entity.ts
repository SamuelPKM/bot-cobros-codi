import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ROLE_VALUES, type Role } from '../types/role.type';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  /** citext: "Ana" y "ana" son el mismo usuario. */
  @Column({ type: 'citext', unique: true })
  username!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'enum', enum: ROLE_VALUES, enumName: 'user_role' })
  role!: Role;

  /** Nunca sale en las respuestas: `select: false` y el mapper público no lo incluye. */
  @Column({ name: 'password_hash', type: 'text', select: false })
  passwordHash!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  /** Tope por cobro del vendedor, en centavos. null = sin tope propio. */
  @Column({ name: 'max_amount_cents', type: 'integer', nullable: true })
  maxAmountCents!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
