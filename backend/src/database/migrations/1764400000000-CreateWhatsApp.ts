import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWhatsApp1764400000000 implements MigrationInterface {
  name = 'CreateWhatsApp1764400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Un WhatsApp por persona y una persona por WhatsApp.
    await queryRunner.query(`
      CREATE TABLE "whatsapp_accounts" (
        "user_id"   integer PRIMARY KEY REFERENCES "users" ("id") ON DELETE CASCADE,
        "wa_id"     text NOT NULL,
        "phone"     char(10) NOT NULL UNIQUE,
        "linked_at" timestamptz NOT NULL DEFAULT now()
      )`);
    // Código de 6 dígitos para ligar el número; se guarda solo su hash.
    await queryRunner.query(`
      CREATE TABLE "whatsapp_link_codes" (
        "user_id"    integer PRIMARY KEY REFERENCES "users" ("id") ON DELETE CASCADE,
        "code_hash"  char(64) NOT NULL UNIQUE,
        "expires_at" timestamptz NOT NULL
      )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "whatsapp_link_codes"`);
    await queryRunner.query(`DROP TABLE "whatsapp_accounts"`);
  }
}
