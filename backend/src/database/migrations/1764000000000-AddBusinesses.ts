import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Negocios con su propia API key de pey. Usuarios y cobros pasan a pertenecer
 * a un negocio. Se aplica antes del primer despliegue, así que no hay datos
 * que asignar; si los hubiera, se detiene en lugar de inventar un negocio.
 */
export class AddBusinesses1764000000000 implements MigrationInterface {
  name = 'AddBusinesses1764000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      `SELECT (SELECT count(*) FROM users) + (SELECT count(*) FROM charges) AS count`,
    )) as { count: string }[];
    if (Number(count) > 0) {
      throw new Error(
        'Hay usuarios o cobros sin negocio: asígnales uno antes de esta migración',
      );
    }

    await queryRunner.query(`
      CREATE TABLE "businesses" (
        "id"                        SERIAL PRIMARY KEY,
        "name"                      varchar(30) NOT NULL CHECK (length(trim("name")) > 0),
        "pey_api_key_sealed"        text NOT NULL,
        "pey_api_key_last4"         varchar(4) NOT NULL,
        "pey_webhook_secret_sealed" text,
        "webhook_slug"              text NOT NULL UNIQUE,
        "created_at"                timestamptz NOT NULL DEFAULT now()
      )`);

    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "business_id" integer NOT NULL REFERENCES "businesses" ("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX "users_by_business" ON "users" ("business_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "charges" ADD COLUMN "business_id" integer NOT NULL REFERENCES "businesses" ("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `CREATE INDEX "charges_by_business" ON "charges" ("business_id", "created_at" DESC)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "charges" DROP COLUMN "business_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "business_id"`);
    await queryRunner.query(`DROP TABLE "businesses"`);
  }
}
