import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCharges1763700000000 implements MigrationInterface {
  name = 'CreateCharges1763700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "charge_status" AS ENUM ('pending', 'paid', 'expired', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "attempt_kind" AS ENUM ('push', 'qr')`,
    );
    await queryRunner.query(
      `CREATE TYPE "attempt_status" AS ENUM ('sending', 'pending', 'unknown', 'paid', 'expired', 'failed')`,
    );
    await queryRunner.query(`
      CREATE TABLE "charges" (
        "id"              SERIAL PRIMARY KEY,
        "seller_id"       integer NOT NULL REFERENCES "users" ("id") ON DELETE RESTRICT,
        "payer_phone"     char(10) NOT NULL CHECK ("payer_phone" ~ '^[0-9]{10}$'),
        "amount_cents"    integer NOT NULL CHECK ("amount_cents" > 0 AND "amount_cents" <= 100000000),
        "concept"         varchar(40),
        "status"          "charge_status" NOT NULL DEFAULT 'pending',
        "paid_via"        "attempt_kind",
        "paid_attempt_id" integer,
        "paid_at"         timestamptz,
        "notified_at"     timestamptz,
        "created_at"      timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `CREATE INDEX "charges_by_seller" ON "charges" ("seller_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "charges_by_status" ON "charges" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "charges_by_payer" ON "charges" ("payer_phone", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "payment_attempts" (
        "id"             SERIAL PRIMARY KEY,
        "charge_id"      integer NOT NULL REFERENCES "charges" ("id") ON DELETE CASCADE,
        "kind"           "attempt_kind" NOT NULL,
        "status"         "attempt_status" NOT NULL DEFAULT 'sending',
        "transaction_id" text UNIQUE,
        "codi_id"        text,
        "qr_id"          text UNIQUE,
        "qr_string"      text,
        "tracking_key"   text,
        "error"          text,
        "expires_at"     timestamptz,
        "created_at"     timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `CREATE INDEX "attempts_by_charge" ON "payment_attempts" ("charge_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "attempts_due" ON "payment_attempts" ("status", "expires_at")`,
    );

    await queryRunner.query(`
      ALTER TABLE "charges" ADD CONSTRAINT "charges_paid_attempt_fk"
        FOREIGN KEY ("paid_attempt_id") REFERENCES "payment_attempts" ("id") ON DELETE SET NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "charges" DROP CONSTRAINT "charges_paid_attempt_fk"`,
    );
    await queryRunner.query(`DROP TABLE "payment_attempts"`);
    await queryRunner.query(`DROP TABLE "charges"`);
    await queryRunner.query(`DROP TYPE "attempt_status"`);
    await queryRunner.query(`DROP TYPE "attempt_kind"`);
    await queryRunner.query(`DROP TYPE "charge_status"`);
  }
}
