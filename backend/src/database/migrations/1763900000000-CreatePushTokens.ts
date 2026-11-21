import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePushTokens1763900000000 implements MigrationInterface {
  name = 'CreatePushTokens1763900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "push_tokens" (
        "token"      text PRIMARY KEY,
        "user_id"    integer NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `CREATE INDEX "push_tokens_by_user" ON "push_tokens" ("user_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "push_tokens"`);
  }
}
