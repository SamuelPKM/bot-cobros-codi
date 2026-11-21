import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { DemoSender } from '../types/demo.types';

/** Un mensaje de la conversación de una sesión de la demo. */
@Entity('demo_messages')
export class DemoMessage {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'session_hash', type: 'char', length: 64 })
  sessionHash!: string;

  @Column({ type: 'text' })
  sender!: DemoSender;

  @Column({ type: 'text' })
  text!: string;

  @Column({ name: 'qr_string', type: 'text', nullable: true })
  qrString!: string | null;

  @Column({ type: 'text', nullable: true })
  url!: string | null;

  /** El cobro que anuncia este "✅ Pagado" (único: se avisa una sola vez). */
  @Column({ name: 'charge_id', type: 'integer', nullable: true, unique: true })
  chargeId!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
