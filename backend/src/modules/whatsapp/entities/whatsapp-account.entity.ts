import { Column, Entity, PrimaryColumn } from 'typeorm';

/** El WhatsApp ligado a una persona del equipo: desde ahí cobra y recibe "✅ Pagado". */
@Entity('whatsapp_accounts')
export class WhatsAppAccount {
  @PrimaryColumn({ name: 'user_id', type: 'integer' })
  userId!: number;

  /** El número tal cual lo entrega Meta; a él se le responde. */
  @Column({ name: 'wa_id', type: 'text' })
  waId!: string;

  /** El mismo número a 10 dígitos; único. */
  @Column({ type: 'char', length: 10, unique: true })
  phone!: string;

  @Column({ name: 'linked_at', type: 'timestamptz', default: () => 'now()' })
  linkedAt!: Date;
}
