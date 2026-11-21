import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChargeDrafts1764300000000 implements MigrationInterface {
  name = 'CreateChargeDrafts1764300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "charge_drafts" (
        "user_id"      integer PRIMARY KEY REFERENCES "users" ("id") ON DELETE CASCADE,
        "payer_phone"  char(10) NOT NULL,
        "amount_cents" integer NOT NULL CHECK ("amount_cents" > 0),
        "concept"      varchar(40),
        "created_at"   timestamptz NOT NULL DEFAULT now()
      )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "charge_drafts"`);
  }
}
