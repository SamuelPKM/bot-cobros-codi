import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1763600000000 implements MigrationInterface {
  name = 'CreateUsers1763600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS citext`);
    await queryRunner.query(
      `CREATE TYPE "user_role" AS ENUM ('admin', 'seller')`,
    );
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"               SERIAL PRIMARY KEY,
        "username"         citext NOT NULL UNIQUE,
        "name"             text NOT NULL,
        "role"             "user_role" NOT NULL,
        "password_hash"    text NOT NULL,
        "active"           boolean NOT NULL DEFAULT true,
        "max_amount_cents" integer CHECK ("max_amount_cents" > 0),
        "created_at"       timestamptz NOT NULL DEFAULT now()
      )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "user_role"`);
  }
}
