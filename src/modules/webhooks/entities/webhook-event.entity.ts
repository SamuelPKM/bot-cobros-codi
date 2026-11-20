import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Registro de cada entrega de webhook, para no procesar dos veces la misma. */
@Entity('webhook_events')
export class WebhookEvent {
  @PrimaryColumn({ type: 'text' })
  source!: string;

  /** Header webhook-id. */
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text', nullable: true })
  type!: string | null;

  @Column({ name: 'received_at', type: 'timestamptz', default: () => 'now()' })
  receivedAt!: Date;

  /** null = llegó pero no se terminó de procesar (pey lo reintentará). */
  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  result!: string | null;
}
