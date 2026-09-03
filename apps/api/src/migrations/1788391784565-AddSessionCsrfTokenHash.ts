import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionCsrfTokenHash1788391784565 implements MigrationInterface {
  name = 'AddSessionCsrfTokenHash1788391784565';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "csrfTokenHash" character varying(255)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN IF EXISTS "csrfTokenHash"`);
  }
}