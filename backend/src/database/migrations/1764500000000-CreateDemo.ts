import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDemo1764500000000 implements MigrationInterface {
  name = 'CreateDemo1764500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "demo_visitor" boolean NOT NULL DEFAULT false`,
    );
    // Una sesión por visitante de la demo pública. Se guarda el hash del id de
    // sesión (es la credencial) y el de la IP (solo para los límites).
    await queryRunner.query(`
      CREATE TABLE "demo_sessions" (
        "id_hash"    char(64) PRIMARY KEY,
        "user_id"    integer NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
        "ip_hash"    char(64) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `CREATE INDEX "demo_sessions_by_ip" ON "demo_sessions" ("ip_hash", "created_at")`,
    );
    await queryRunner.query(`
      CREATE TABLE "demo_messages" (
        "id"           serial PRIMARY KEY,
        "session_hash" char(64) NOT NULL REFERENCES "demo_sessions" ("id_hash") ON DELETE CASCADE,
        "sender"       text NOT NULL CHECK ("sender" IN ('visitor', 'bot')),
        "text"         text NOT NULL,
        "qr_string"    text,
        "url"          text,
        "charge_id"    integer UNIQUE REFERENCES "charges" ("id") ON DELETE SET NULL,
        "created_at"   timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `CREATE INDEX "demo_messages_by_session" ON "demo_messages" ("session_hash", "id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "demo_messages"`);
    await queryRunner.query(`DROP TABLE "demo_sessions"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "demo_visitor"`);
  }
}
