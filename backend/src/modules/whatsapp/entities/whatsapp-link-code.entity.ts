import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Código vigente para ligar un WhatsApp (uno por persona, un solo uso). */
@Entity('whatsapp_link_codes')
export class WhatsAppLinkCode {
  @PrimaryColumn({ name: 'user_id', type: 'integer' })
  userId!: number;

  /** sha256 del código; el código en claro solo se muestra al crearlo. */
  @Column({ name: 'code_hash', type: 'char', length: 64, unique: true })
  codeHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;
}
