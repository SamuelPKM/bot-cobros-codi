import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInvitations1764100000000 implements MigrationInterface {
  name = 'CreateInvitations1764100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "invitations" (
        "id"               SERIAL PRIMARY KEY,
        "business_id"      integer NOT NULL REFERENCES "businesses" ("id") ON DELETE CASCADE,
        "role"             "user_role" NOT NULL,
        "token_hash"       char(64) NOT NULL UNIQUE,
        "created_by"       integer NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
        "expires_at"       timestamptz NOT NULL,
        "accepted_at"      timestamptz,
        "accepted_user_id" integer REFERENCES "users" ("id") ON DELETE SET NULL,
        "revoked_at"       timestamptz,
        "created_at"       timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `CREATE INDEX "invitations_by_business" ON "invitations" ("business_id", "created_at")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "invitations"`);
  }
}
