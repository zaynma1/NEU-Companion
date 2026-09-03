import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionCsrfTokenHash20260903120002 implements MigrationInterface {
  name = 'AddSessionCsrfTokenHash20260903120002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sessions" ADD "csrfTokenHash" character varying(255)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN "csrfTokenHash"`);
  }
}