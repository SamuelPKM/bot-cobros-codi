import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import {
  ATTEMPT_KINDS,
  CHARGE_STATUSES,
  type AttemptKind,
  type ChargeStatus,
} from '../types/charge.types';
import { PaymentAttempt } from './payment-attempt.entity';

/** Una venta que un vendedor le cobra a un cliente. */
@Entity('charges')
export class Charge {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'seller_id', type: 'integer' })
  sellerId!: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'seller_id' })
  seller?: User;

  /** Celular del cliente, 10 dígitos. */
  @Column({ name: 'payer_phone', type: 'char', length: 10 })
  payerPhone!: string;

  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents!: number;

  /** Concepto que escribió el vendedor (sin el nombre del negocio). */
  @Column({ type: 'varchar', length: 40, nullable: true })
  concept!: string | null;

  @Column({
    type: 'enum',
    enum: CHARGE_STATUSES,
    enumName: 'charge_status',
    default: 'pending',
  })
  status!: ChargeStatus;

  @Column({
    name: 'paid_via',
    type: 'enum',
    enum: ATTEMPT_KINDS,
    enumName: 'attempt_kind',
    nullable: true,
  })
  paidVia!: AttemptKind | null;

  @Column({ name: 'paid_attempt_id', type: 'integer', nullable: true })
  paidAttemptId!: number | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt!: Date | null;

  /** Cuándo se avisó del pago al vendedor y al admin (null = aviso pendiente). */
  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notifiedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => PaymentAttempt, (attempt) => attempt.charge)
  attempts?: PaymentAttempt[];
}
