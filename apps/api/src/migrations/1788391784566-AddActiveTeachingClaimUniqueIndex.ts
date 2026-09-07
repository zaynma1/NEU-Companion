import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActiveTeachingClaimUniqueIndex1788391784566 implements MigrationInterface {
  name = 'AddActiveTeachingClaimUniqueIndex1788391784566';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_professor_teaching_claims_active_group" ON "professor_teaching_claims" ("course_group_id") WHERE "released_at" IS NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "public"."IDX_professor_teaching_claims_active_group"');
  }
}