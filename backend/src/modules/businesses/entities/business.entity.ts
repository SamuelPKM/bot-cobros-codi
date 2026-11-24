import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Un negocio con sus propias credenciales de pey. Los cobros de su equipo se
 * hacen con SU API key, así el dinero llega a la cuenta del titular de esas
 * credenciales (regla 7.3(c) del hackatón).
 */
@Entity('businesses')
export class Business {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Va al inicio del concepto que ve quien paga (máx. 30). */
  @Column({ type: 'varchar', length: 30 })
  name!: string;

  /** API key de pey cifrada con SecretBox. Nunca sale de la API. */
  @Column({ name: 'pey_api_key_sealed', type: 'text', select: false })
  peyApiKeySealed!: string;

  /** Últimos 4 caracteres, para que el admin reconozca cuál registró. */
  @Column({ name: 'pey_api_key_last4', type: 'varchar', length: 4 })
  peyApiKeyLast4!: string;

  /** Secreto del webhook de su API key (whsec_...), cifrado. null hasta que lo registre. */
  @Column({
    name: 'pey_webhook_secret_sealed',
    type: 'text',
    nullable: true,
    select: false,
  })
  peyWebhookSecretSealed!: string | null;

  /** Identificador público y aleatorio de su URL de webhook: /webhooks/pey/:slug. */
  @Column({ name: 'webhook_slug', type: 'text', unique: true })
  webhookSlug!: string;

  /** Llave del logo en S3 (logos/<id>/<aleatorio>.<ext>); null sin logo. */
  @Column({ name: 'logo_key', type: 'text', nullable: true })
  logoKey!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
