import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** Una sesión de la demo pública: un visitante con su propio vendedor desechable. */
@Entity('demo_sessions')
export class DemoSession {
  /** sha256 del id de sesión que viaja en X-Demo-Session. */
  @PrimaryColumn({ name: 'id_hash', type: 'char', length: 64 })
  idHash!: string;

  @Column({ name: 'user_id', type: 'integer' })
  userId!: number;

  /** sha256 de la IP; solo para limitar sesiones por conexión. */
  @Column({ name: 'ip_hash', type: 'char', length: 64 })
  ipHash!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
