# Backup and Restore Runbook

## Purpose

This runbook defines the operational backup and restore process for the NEU Companion backend so the team can recover from data loss, corruption, or service disruption while satisfying the MVP continuity targets:

- Recovery Point Objective (RPO): 24 hours
- Recovery Time Objective (RTO): 8 hours
- Backup frequency: daily automated database snapshots
- Restore validation: required before returning the service to production use

## Scope

This runbook covers the application database, the application configuration required for startup, and any supporting operational artifacts required to re-establish a consistent service state.

In scope:
- PostgreSQL database contents
- TypeORM migration metadata and schema version state
- `system_config` values, especially `active_term` and `campus_timezone`
- admin-managed domain configuration and security settings
- import dataset state and published dataset versions
- audit log integrity evidence and external backup exports

Out of scope:
- source code repositories and CI artifacts
- managed cloud secrets beyond the app environment values needed at startup
- long-term archival or external analytics copies outside defined operations retention

## Roles and responsibilities

### Primary owners
- Platform/engineering owner: schedules backups, validates restore drills, and approves production restore execution
- Backend owner: verifies the application is healthy after restore and confirms data integrity
- Admin owner: confirms configuration and access policy values after recovery

### Required approvals
- Production restores require approval from the engineering owner and application owner
- Any restore affecting the active dataset or admin config must be coordinated with the admin owner before re-enabling writes

## Backup policy

### Automated backup schedule

The application must perform daily database backups and retain them according to the defined retention policy.

Minimum requirements:
- Daily full backup of the application database
- A separate backup copy stored outside the primary database environment
- Backups encrypted at rest
- Backup file metadata recorded with timestamp, source environment, and backup checksum
- Backup validation step after creation to confirm integrity

### Retention

- Keep daily backups for the current operating window, with a minimum retention period that supports the 24-hour RPO target
- Retain backup metadata and checksum evidence with the backup artifact
- Retain audit and security evidence according to the 180-day operational retention policy

### Verification

Every scheduled backup must be validated before it is considered usable:
- confirm the file is readable
- confirm the database dump is structurally valid
- confirm checksum/mutability checks pass
- confirm the backup can be restored in a staging environment at least once per emergency drill window

## Restore prerequisites

Before any restore begins:

1. Confirm the incident scope and impact
2. Confirm whether the restore is for the primary or a staging environment
3. Confirm the target environment is isolated from active writes
4. Confirm the correct backup point in time
5. Confirm the application is set to maintenance mode or read-only mode if needed
6. Confirm the team has the required database credentials, migration tooling, and access to the backup artifact
7. Confirm admin operators are available to validate config and access policies after restore

## Restore sequence

Restore execution must follow this order:

1. Stop write traffic to the application
2. Snapshot the current environment state if the system is partially healthy
3. Load the validated backup artifact into the target database
4. Reconcile schema and migration state
5. Re-run the application migration path if the restored environment requires schema parity
6. Restore or verify `system_config` values
7. Validate `allowed_email_domains` and role/config restrictions
8. Validate dataset version consistency and current published term state
9. Reconcile sessions and security state as needed
10. Bring the application back into service once integrity checks pass

## Critical validation checks

A successful restore requires all of the following checks to pass before the application is marked healthy:

### Database integrity
- all required tables exist
- no orphaned foreign keys remain after restore
- current dataset version integrity is consistent with the published term
- `system_config.active_term` matches the expected active term
- `system_config.campus_timezone` is present and valid

### Identity and access
- `users` rows are consistent with expected sign-in data
- `allowed_email_domains` is present and has at least one valid domain entry
- role and account status data are still valid
- active admin accounts are not accidentally removed or demoted

### Operational replay and audit
- `audit_log_entries` remain append-only and readable
- no required audit rows were dropped or corrupted
- security alerts and import history remain consistent with the restored snapshot

### Data correctness
- published `dataset_versions` still reflect the correct term state
- `official_events` and `course_groups` are consistent with the restored dataset
- notification and announcement tables are not partially restored or mismatched

## Post-restore verification

After the environment comes back online, perform the following verifications:

1. Confirm the API can boot successfully
2. Confirm database connectivity and query paths are stable
3. Confirm admin login works
4. Confirm `system_config` read back matches expected values
5. Confirm active term and current dataset version are consistent
6. Confirm a representative user flow works: login, timetable fetch, and admin review or config view
7. Confirm imports and announcements still have valid referential integrity
8. Confirm audit logs and alert views are reachable

## Rollback from a restore attempt

If validation fails during a restore:
- stop the restore immediately
- do not leave partially applied schema state in production
- revert to the previous environment snapshot or last known-good DB state
- retain the failed restore artifact and logs for incident review
- document the failure cause before retrying

## Incident communications

During a restore event, record and communicate:
- incident start time
- affected environment
- selected backup point
- restore status and blocker messages
- time of full service restoration

## Security and privacy controls

- Backups must be encrypted at rest
- Access to restore artifacts must be restricted to authorized operators
- Backup media and copies must be stored away from the live application environment
- Audit data must remain tamper-evident and protected from unauthorized mutation
- No PII should be written to unencrypted logs or operational notices

## Recovery drill requirement

The team should run at least one restore drill per quarter to confirm:
- the backup is valid
- the restore path is reproducible
- the target environment can be brought back online within the 8-hour RTO
- all critical validation checks pass before service re-entry

## Escalation path

If a restore cannot complete within the agreed operational window:
- escalate to the engineering owner
- escalate to the platform owner for infrastructure support
- notify the admin owner if access policy or current-term config may be affected
- capture the blocker, attempted steps, and required decisions for the post-mortem

## Checklist for operators

Before declaring recovery successful, confirm all of the following:

- [ ] Backup selected has been validated
- [ ] Target environment was isolated before restore
- [ ] Database and schema state are consistent
- [ ] `system_config` values were checked and restored
- [ ] `active_term` and `campus_timezone` are valid
- [ ] No orphaned audit or import data remains
- [ ] A representative user flow has passed
- [ ] Admin access and role checks are working
- [ ] Service is re-enabled only after validation succeeds

## Related requirements

This runbook is grounded in the MVP requirements for backup and restore targets in [docs/requirements.md](requirements.md):

- daily backups with RPO of 24 hours
- RTO of 8 hours
- encryption at rest for databases and backups
- backup integrity and external tamper-evident evidence for audit logs and security events

This runbook also aligns with the schema and operational safeguards described in [docs/database-design.md](database-design.md).
