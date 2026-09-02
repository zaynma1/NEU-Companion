import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPersonalEventExceptions20260903120001 implements MigrationInterface {
  name = 'AddPersonalEventExceptions20260903120001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "personal_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text,
        "startDatetime" TIMESTAMPTZ NOT NULL,
        "endDatetime" TIMESTAMPTZ NOT NULL,
        "is_recurring" boolean NOT NULL DEFAULT false,
        "recurrence_rule" text,
        "recurrence_end_date" TIMESTAMPTZ,
        "location" character varying(255),
        "eventType" character varying(255),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_personal_events" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "personal_event_exceptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "personal_event_id" uuid NOT NULL,
        "occurrence_start_datetime" TIMESTAMPTZ NOT NULL,
        "is_cancelled" boolean NOT NULL DEFAULT false,
        "start_datetime" TIMESTAMPTZ,
        "end_datetime" TIMESTAMPTZ,
        "title" character varying(255),
        "description" text,
        "location" character varying(255),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_personal_event_exceptions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_personal_event_exceptions_event_occurrence" UNIQUE ("personal_event_id", "occurrence_start_datetime"),
        CONSTRAINT "FK_personal_event_exceptions_personal_event_id" FOREIGN KEY ("personal_event_id") REFERENCES "personal_events"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_personal_event_exceptions_personal_event_id"
      ON "personal_event_exceptions" ("personal_event_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_personal_event_exceptions_occurrence_start_datetime"
      ON "personal_event_exceptions" ("occurrence_start_datetime");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "personal_event_exceptions";`);
  }
}
