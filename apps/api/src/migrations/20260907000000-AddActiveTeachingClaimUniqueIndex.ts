import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActiveTeachingClaimUniqueIndex20260907000000 implements MigrationInterface {
  name = 'AddActiveTeachingClaimUniqueIndex20260907000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        DO $$
        BEGIN
          IF to_regclass('public.professor_teaching_claims') IS NOT NULL THEN
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_professor_teaching_claims_active_group"
              ON "professor_teaching_claims" ("course_group_id")
              WHERE "released_at" IS NULL;
          END IF;
        END
        $$;
      `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_professor_teaching_claims_active_group"');
  }
}