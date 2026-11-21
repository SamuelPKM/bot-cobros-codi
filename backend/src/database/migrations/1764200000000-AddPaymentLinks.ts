import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Liga de pago como tercer tipo de intento, y cobros sin teléfono (QR o liga
 * que el vendedor muestra o reenvía).
 */
export class AddPaymentLinks1764200000000 implements MigrationInterface {
  name = 'AddPaymentLinks1764200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "attempt_kind" ADD VALUE IF NOT EXISTS 'link'`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_attempts" ADD COLUMN "link_id" text UNIQUE`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_attempts" ADD COLUMN "link_url" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "charges" ALTER COLUMN "payer_phone" DROP NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres no permite quitar un valor de un enum; 'link' se queda en attempt_kind.
    await queryRunner.query(
      `ALTER TABLE "charges" ALTER COLUMN "payer_phone" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_attempts" DROP COLUMN "link_url"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_attempts" DROP COLUMN "link_id"`,
    );
  }
}
