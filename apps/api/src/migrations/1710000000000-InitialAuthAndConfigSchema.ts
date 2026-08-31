import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialAuthAndConfigSchema1710000000000 implements MigrationInterface {
  name = 'InitialAuthAndConfigSchema1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "googleSubjectId" character varying,
        "email" character varying,
        "fullName" character varying,
        "username" character varying,
        "studentOrStaffId" character varying,
        "department" character varying,
        "role" character varying(32) NOT NULL DEFAULT 'pending',
        "accountStatus" character varying(32) NOT NULL DEFAULT 'active',
        "onboardingCompletedAt" TIMESTAMPTZ,
        "isSystemPlaceholder" boolean NOT NULL DEFAULT false,
        "professorVerifiedAt" TIMESTAMPTZ,
        "deletionRequestedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_googleSubjectId" UNIQUE ("googleSubjectId"),
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "UQ_users_studentOrStaffId" UNIQUE ("studentOrStaffId")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "tokenHash" character varying(255) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "lastActiveAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "idleExpiresAt" TIMESTAMPTZ NOT NULL,
        "absoluteExpiresAt" TIMESTAMPTZ NOT NULL,
        "stepUpVerifiedAt" TIMESTAMPTZ,
        "deviceFingerprint" character varying(255) NOT NULL,
        "ipCountry" character varying(255),
        "revokedAt" TIMESTAMPTZ,
        "revokedReason" character varying(255),
        CONSTRAINT "PK_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sessions_tokenHash" UNIQUE ("tokenHash"),
        CONSTRAINT "FK_sessions_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "auth_attempts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clientFingerprint" character varying(255) NOT NULL,
        "clientIpHash" character varying(255),
        "accountUserId" uuid,
        "outcome" character varying(64) NOT NULL,
        "ipCountry" character varying(64),
        "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auth_attempts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_auth_attempts_accountUserId" FOREIGN KEY ("accountUserId") REFERENCES "users"("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "challenges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "authAttemptId" uuid NOT NULL,
        "accountUserId" uuid,
        "sessionId" uuid,
        "challengeType" character varying(32) NOT NULL,
        "deviceFingerprint" character varying(255) NOT NULL,
        "purpose" character varying(255) NOT NULL,
        "challengeSecretHash" character varying(255) NOT NULL,
        "issuedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "consumedAt" TIMESTAMPTZ,
        "failedAttempts" smallint NOT NULL DEFAULT 0,
        CONSTRAINT "PK_challenges" PRIMARY KEY ("id"),
        CONSTRAINT "FK_challenges_authAttemptId" FOREIGN KEY ("authAttemptId") REFERENCES "auth_attempts"("id"),
        CONSTRAINT "FK_challenges_accountUserId" FOREIGN KEY ("accountUserId") REFERENCES "users"("id"),
        CONSTRAINT "FK_challenges_sessionId" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "allowed_email_domains" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "emailDomain" character varying(255) NOT NULL,
        "allowSubdomains" boolean NOT NULL DEFAULT false,
        "createdBy" uuid,
        "updatedBy" uuid,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_allowed_email_domains" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_allowed_email_domains_emailDomain" UNIQUE ("emailDomain")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "role_assignment_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "domainPattern" character varying(255) NOT NULL,
        "inferredRole" character varying(32) NOT NULL,
        "priority" integer NOT NULL DEFAULT 100,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_role_assignment_rules" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_log_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actorId" uuid,
        "actorLabelSnapshot" character varying(255),
        "actionType" character varying(128) NOT NULL,
        "targetEntity" character varying(128) NOT NULL,
        "targetId" uuid,
        "beforeValue" jsonb,
        "afterValue" jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_log_entries" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "system_config" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "key" character varying(255) NOT NULL,
        "value" text NOT NULL,
        "updatedBy" uuid,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_system_config" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_system_config_key" UNIQUE ("key")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "pending_review_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "reviewerId" uuid,
        "decision" character varying(32),
        "proposedRole" character varying(32),
        "submittedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "dueBy" TIMESTAMPTZ NOT NULL,
        "decidedAt" TIMESTAMPTZ,
        "resolutionNotes" text,
        CONSTRAINT "PK_pending_review_items" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "security_alerts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "alertType" character varying(64) NOT NULL,
        "relatedAuthAttemptId" uuid,
        "triggeredAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "acknowledgedAt" TIMESTAMPTZ,
        CONSTRAINT "PK_security_alerts" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "deletion_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "status" character varying(32) NOT NULL DEFAULT 'pending',
        "reason" text,
        "confirmation" boolean NOT NULL DEFAULT false,
        "requestedAt" TIMESTAMPTZ,
        "completedAt" TIMESTAMPTZ,
        "cancelledAt" TIMESTAMPTZ,
        "legalHoldReason" text,
        "legalHoldUntil" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_deletion_requests" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_googleSubjectId" ON "users" ("googleSubjectId");
      CREATE INDEX "IDX_users_email" ON "users" ("email");
      CREATE INDEX "IDX_users_role" ON "users" ("role");
      CREATE INDEX "IDX_users_accountStatus" ON "users" ("accountStatus");
      CREATE INDEX "IDX_sessions_userId" ON "sessions" ("userId");
      CREATE INDEX "IDX_sessions_idleExpiresAt" ON "sessions" ("idleExpiresAt");
      CREATE INDEX "IDX_sessions_absoluteExpiresAt" ON "sessions" ("absoluteExpiresAt");
      CREATE INDEX "IDX_auth_attempts_accountUserId" ON "auth_attempts" ("accountUserId");
      CREATE INDEX "IDX_auth_attempts_occurredAt" ON "auth_attempts" ("occurredAt");
      CREATE INDEX "IDX_challenges_authAttemptId" ON "challenges" ("authAttemptId");
      CREATE INDEX "IDX_challenges_accountUserId" ON "challenges" ("accountUserId");
      CREATE INDEX "IDX_challenges_sessionId" ON "challenges" ("sessionId");
      CREATE INDEX "IDX_challenges_expiresAt" ON "challenges" ("expiresAt");
      CREATE INDEX "IDX_allowed_email_domains_emailDomain" ON "allowed_email_domains" ("emailDomain");
      CREATE INDEX "IDX_role_assignment_rules_priority" ON "role_assignment_rules" ("priority");
      CREATE INDEX "IDX_audit_log_entries_actorId" ON "audit_log_entries" ("actorId");
      CREATE INDEX "IDX_audit_log_entries_targetEntity" ON "audit_log_entries" ("targetEntity");
      CREATE INDEX "IDX_audit_log_entries_createdAt" ON "audit_log_entries" ("createdAt");
      CREATE INDEX "IDX_system_config_key" ON "system_config" ("key");
      CREATE INDEX "IDX_pending_review_items_userId" ON "pending_review_items" ("userId");
      CREATE INDEX "IDX_pending_review_items_dueBy" ON "pending_review_items" ("dueBy");
      CREATE INDEX "IDX_security_alerts_userId" ON "security_alerts" ("userId");
      CREATE INDEX "IDX_security_alerts_triggeredAt" ON "security_alerts" ("triggeredAt");
      CREATE INDEX "IDX_deletion_requests_userId" ON "deletion_requests" ("userId");
      CREATE INDEX "IDX_deletion_requests_status" ON "deletion_requests" ("status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "deletion_requests";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "security_alerts";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pending_review_items";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "system_config";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_log_entries";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_assignment_rules";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "allowed_email_domains";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "challenges";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "auth_attempts";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sessions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);
  }
}
