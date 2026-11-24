import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusinessLogo1764600000000 implements MigrationInterface {
  name = 'AddBusinessLogo1764600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Llave del logo en S3 (logos/<negocio>/<aleatorio>.<ext>); null sin logo.
    await queryRunner.query(`ALTER TABLE "businesses" ADD "logo_key" text`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN "logo_key"`);
  }
}
