import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  ATTEMPT_KINDS,
  ATTEMPT_STATUSES,
  type AttemptKind,
  type AttemptStatus,
} from '../types/charge.types';
import { Charge } from './charge.entity';

/** Un intento de cobrar un Charge: un push al celular o un QR. */
@Entity('payment_attempts')
export class PaymentAttempt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'charge_id', type: 'integer' })
  chargeId!: number;

  @ManyToOne(() => Charge, (charge) => charge.attempts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'charge_id' })
  charge?: Charge;

  @Column({ type: 'enum', enum: ATTEMPT_KINDS, enumName: 'attempt_kind' })
  kind!: AttemptKind;

  @Column({
    type: 'enum',
    enum: ATTEMPT_STATUSES,
    enumName: 'attempt_status',
    default: 'sending',
  })
  status!: AttemptStatus;

  /** Push: transactionId de pey. */
  @Column({
    name: 'transaction_id',
    type: 'text',
    nullable: true,
    unique: true,
  })
  transactionId!: string | null;

  /** Push: folio CoDi de Banxico. */
  @Column({ name: 'codi_id', type: 'text', nullable: true })
  codiId!: string | null;

  /** QR: IDC de Banxico. */
  @Column({ name: 'qr_id', type: 'text', nullable: true, unique: true })
  qrId!: string | null;

  /** QR: contenido tal como lo da pey, para volver a mostrarlo. */
  @Column({ name: 'qr_string', type: 'text', nullable: true })
  qrString!: string | null;

  @Column({ name: 'tracking_key', type: 'text', nullable: true })
  trackingKey!: string | null;

  /** Motivo para el vendedor cuando el intento falló o quedó en duda. */
  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
