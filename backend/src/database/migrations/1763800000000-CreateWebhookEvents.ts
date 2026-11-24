import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWebhookEvents1763800000000 implements MigrationInterface {
  name = 'CreateWebhookEvents1763800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "webhook_events" (
        "source"       text NOT NULL,
        "id"           text NOT NULL,
        "type"         text,
        "received_at"  timestamptz NOT NULL DEFAULT now(),
        "processed_at" timestamptz,
        "result"       text,
        PRIMARY KEY ("source", "id")
      )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "webhook_events"`);
  }
}
