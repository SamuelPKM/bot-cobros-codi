import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Cobro push escrito en el chat que espera un "sí". Uno por persona: un cobro
 * nuevo reemplaza al anterior. Al confirmar se borra en la misma sentencia que
 * lo lee, así dos "sí" seguidos nunca mandan dos cobros.
 */
@Entity('charge_drafts')
export class ChargeDraft {
  @PrimaryColumn({ name: 'user_id', type: 'integer' })
  userId!: number;

  @Column({ name: 'payer_phone', type: 'char', length: 10 })
  payerPhone!: string;

  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents!: number;

  @Column({ type: 'varchar', length: 40, nullable: true })
  concept!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
