import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChargeTip1764700000000 implements MigrationInterface {
  name = 'AddChargeTip1764700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // amount_cents sigue siendo el total que se cobra en pey; la propina va incluida.
    await queryRunner.query(
      `ALTER TABLE "charges" ADD "tip_cents" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "charges" ADD CONSTRAINT "CHK_charges_tip_cents" CHECK ("tip_cents" >= 0 AND "tip_cents" < "amount_cents")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "charges" DROP CONSTRAINT "CHK_charges_tip_cents"`,
    );
    await queryRunner.query(`ALTER TABLE "charges" DROP COLUMN "tip_cents"`);
  }
}
