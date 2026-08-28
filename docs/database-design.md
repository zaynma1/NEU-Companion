# Database Schema Design

This design is derived from the MVP requirements and approved decisions D1-D43. It describes PostgreSQL tables, keys, constraints, and responsibilities. Application and infrastructure controls are identified where database constraints are not sufficient.

## Conventions

- Primary keys are UUIDs unless noted otherwise.
- Timestamps use `timestamptz` and are stored in UTC. The configured campus timezone is applied at display and reminder-calculation layers.
- Official timetable data is immutable after publication. Corrections and rollback are new dataset publications.
- Snapshot fields are intentionally denormalized so historical records survive reassignment or anonymization.
- PostgreSQL enums are named types in the implementation; values are listed below.

## 1. Identity and Access

### `users`

One row per person ever. Rows are never deleted; personal data is anonymized in place.

| Column | Type | Constraints / meaning |
|---|---|---|
| `id` | uuid | Primary key |
| `google_subject_id` | text | Not null, unique; changed to `deleted:<uuid>` on deletion |
| `email` | text | Nullable, not unique; used as the notification email-fallback destination when present |
| `full_name` | text | Nullable during shell-row creation; cleared on anonymization |
| `username` | text | Nullable, unique |
| `student_or_staff_id` | text | Nullable, unique when present |
| `department` | text | Nullable during onboarding |
| `role` | enum | `pending`, `student`, `professor`, `admin`; default `pending` |
| `account_status` | enum | `active`, `suspended`, `blocked`, `deletion_pending`; default `active` |
| `onboarding_completed_at` | timestamptz | Null until full name, ID, and department are present |
| `is_system_placeholder` | boolean | Not null, default false; at most one true row |
| `deletion_requested_at` | timestamptz | Nullable; set when an active deletion request is created |
| `created_at` | timestamptz | Not null, default now() |

The anonymized placeholder uses reserved sentinel identity values, is excluded from normal login/contact behavior, and is protected from ordinary profile, role, deletion, and contact operations by application logic.

### `role_assignment_rules`

`id uuid` primary key, `domain_pattern text not null`, `inferred_role enum not null` (`student`, `professor`, `admin`), and `priority integer not null`. Lower priority values are evaluated first. Domain and subdomain policy remains application configuration.

### `pending_review_items`

`id uuid` primary key, `user_id uuid not null` references `users`, `reviewer_id uuid` references `users`, `decision enum` (`approved`, `rejected`, `reassigned`, `superseded`), `submitted_at timestamptz not null default now()`, `due_by timestamptz not null`, `decided_at timestamptz`, and `resolution_notes text`. Decisions are write-once when `decision IS NULL`; the SLA is calculated at insertion. A direct role correction may atomically mark an open item as `superseded`.

### `audit_log_entries`

Append-only: `id uuid` primary key, nullable `actor_id` references `users`, required frozen `actor_label_snapshot` containing only a stable non-PII actor label, `action_type`, `target_entity`, `target_id uuid`, `before_value jsonb`, `after_value jsonb`, and `created_at timestamptz not null default now()`.

Deletions, document access, role and teaching-claim changes, imports, rollbacks, verification changes, security events, and other disputed or security-relevant mutations are logged. Routine successful authorization checks are not logged. `actor_label_snapshot`, `before_value`, and `after_value` must use an allow-list of non-PII fields and must not contain email, full name, student/staff ID, phone number, or arbitrary profile data. Database grants deny UPDATE/DELETE, and periodic integrity exports or backups are kept outside the application database to provide tamper evidence. A scheduled retention job purges audit rows older than the configured 180-day retention period and applies the same policy to external integrity copies.

### `allowed_email_domains`

`email_domain text` primary key (e.g., `example.com`), `allow_subdomains boolean not null default false`, `created_at timestamptz not null default now()`, `created_by uuid not null` references `users`, `updated_at timestamptz not null default now()`, and `updated_by uuid not null` references `users`.

Admin-managed list of allowed Google OAuth email domains. The application denies sign-in for users whose Google email domain is not in this list. When `allow_subdomains` is true for a domain, users from any subdomain (e.g., `sub.example.com`) are also allowed. All changes are audit-logged. At least one domain must exist or no users can log in.

## 2. Courses, Groups, and Enrollment

### `courses`

`id uuid` primary key, `course_code text not null`, `term text not null`, `title text not null`, nullable `department`, and unique `(course_code, term)`.

### `course_groups`

`id uuid` primary key, `course_id uuid not null` references `courses`, `group_label text not null`, nullable `professor_raw_name text`, `is_archived boolean not null default false`, and unique `(course_id, group_label)` plus unique `(id, course_id)` for announcement consistency checks.

Course/group term identity is treated as immutable once official events exist. Groups are archived rather than hard-deleted.

`professor_raw_name` preserves the professor name exactly as supplied by the automated Excel import. It is informational and is not an identity or authorization link. Enrollment is unrestricted; no capacity constraint is stored or enforced.

### `professor_teaching_claims`

`id uuid` primary key, `professor_id uuid not null` references `users`, `course_group_id uuid not null` references `course_groups`, `claimed_at timestamptz not null default now()`, and nullable `released_at`.

Use a partial unique index on `course_group_id` where `released_at IS NULL` to allow at most one active relationship per course group. Professors may create or release their own claims, and authorized admins may assign or revoke relationships, only when the course group's term equals `system_config.active_term`; announcement authorization repeats this active-term check. Assignments and claims are audit-logged; automated verification or linking of the raw imported name to a user account is outside the MVP integrity model.

### `enrollments`

`id uuid` primary key, `student_id uuid not null` references `users`, `course_group_id uuid not null` references `course_groups`, `status enum` (`active`, `dropped`) default `active`, `enrolled_at timestamptz not null default now()`, and nullable `dropped_at`.

The enrollment term is derived through `course_group_id` to `courses.term`. Use a partial unique index on `(student_id, course_group_id)` where `status = 'active'`. Group switching creates a new active row after soft-dropping the old row. A student may hold active enrollments in multiple groups of the same course.

## 3. Timetable and Import Pipeline

### `import_batches`

`id uuid` primary key, `term text not null`, `uploaded_by uuid not null` references `users`, `file_name text not null`, `template_version text not null`, `content_hash text not null`, `status enum` (`validating`, `validated`, `failed`, `applied`, `rolled_back`, `expired`) default `validating`, nullable `row_count`, `created_at timestamptz not null default now()`, nullable `applied_at`, and nullable `expired_at`.

Admin authorization, file whitelist, size/row limits, malware scanning, timeout, retry, and destructive-change confirmation are application or infrastructure controls. Content hash is retained for audit; diff-based processing defines idempotency.

### `import_row_errors`

`id uuid` primary key, `import_batch_id uuid not null` references `import_batches`, `row_number integer not null`, `field_name text not null`, and `error_reason text not null`.

### `dataset_versions`

`id uuid` primary key and version ID, `term text not null`, `import_batch_id uuid not null` references `import_batches`, nullable `previous_version_id` self-reference, `is_current boolean not null default false`, and `published_at timestamptz not null default now()`.

A partial unique index on `(term)` where `is_current = true` guarantees one current version per term. Apply and rollback swap current flags in one transaction. No version is deleted; rollback publishes an audit-logged restoration event.

### `official_events`

`id uuid` primary key, `dataset_version_id uuid not null` references `dataset_versions`, `course_group_id uuid not null` references `course_groups`, `event_type enum` (`lecture`, `exam`) not null, `start_datetime timestamptz not null`, `end_datetime timestamptz not null`, and nullable `location`.

`term` is deliberately not stored here; it is derived through `course_group_id` to `courses`. Import and read queries filter term through those joins. Normalize locations by trimming whitespace and converting blank values to `NULL`. Use a unique expression index on `(dataset_version_id, course_group_id, event_type, start_datetime, COALESCE(normalized_location, ''))`. This preserves TBA display behavior while rejecting duplicate no-location events within one dataset version. Add a check that `end_datetime > start_datetime`. `course_group_id` encodes course, group, and term through immutable relationships.

### `personal_events`

`id uuid` primary key, `user_id uuid not null` references `users`, `title text not null`, nullable `description`, `start_datetime timestamptz not null`, `end_datetime timestamptz not null`, `is_recurring boolean not null default false`, nullable `recurrence_rule`, nullable `recurrence_end_date`, nullable `location`, nullable `event_type`, `created_at timestamptz not null default now()`, and `updated_at timestamptz not null default now()`.

Personal events are user-owned and isolated. Recurrence rules and the maximum future horizon are application validations. References from notifications use `ON DELETE SET NULL` so deleting a personal event does not orphan notification history.

### `personal_event_exceptions`

`id uuid` primary key, `personal_event_id uuid not null` references `personal_events` with `ON DELETE CASCADE`, `occurrence_start_datetime timestamptz not null`, `is_cancelled boolean not null default false`, nullable `start_datetime`, nullable `end_datetime`, nullable `title`, nullable `description`, nullable `location`, `created_at timestamptz not null default now()`, and `updated_at timestamptz not null default now()`.

Unique `(personal_event_id, occurrence_start_datetime)` identifies one exception per generated occurrence. Exceptions persist this-occurrence changes and cancellations without mutating the recurring series.

## 4. Notifications and Announcements

### `notification_preferences`

`user_id uuid` primary key references `users`, `reminders_enabled boolean not null default true`, and `announcements_enabled boolean not null default true`.

### `muted_courses`

Primary key `(user_id, course_id)`, with foreign keys to `users` and `courses`.

### `announcements`

`id uuid` primary key, `course_id uuid not null` references `courses`, `course_group_id uuid not null` references `course_groups`, `professor_id uuid not null` references `users` as a frozen author snapshot, `body text not null`, `published_at timestamptz not null default now()`, nullable `expiry_at`, and `created_at timestamptz not null default now()`.

Add a composite foreign key from `(course_group_id, course_id)` to a matching unique `(id, course_id)` key on `course_groups` so the two course references cannot disagree. An active `professor_teaching_claims` row authorizes the professor to publish for the specific group only when that group's term equals `system_config.active_term`. Enrollment eligibility, future expiry, and the transactional per-course daily cap are application rules. Announcements are not automatically expanded to other groups in the same course. Expired status is calculated at query time.

### `notifications`

`id uuid` primary key, `recipient_id uuid not null` references `users`, `notification_type enum` (`reminder`, `announcement`) not null, nullable `official_event_id` references `official_events`, nullable `personal_event_id` references `personal_events` with `ON DELETE SET NULL`, nullable `announcement_id` references `announcements`, nullable `reminder_window enum` (`1_day`, `3_hour`, `1_hour`, `at_due`), `channel enum` (`in_app`, `email`) not null, `status enum` (`queued`, `delivered`, `failed`, `suppressed`) default `queued`, nullable `reason_code`, unique `idempotency_key`, nullable `triggered_by_notification_id` self-reference, nullable `read_at`, `created_at timestamptz not null default now()`, and nullable `delivered_at`.

Canonical notification integrity check:

```sql
CHECK (
  (notification_type = 'reminder' AND announcement_id IS NULL
   AND reminder_window IS NOT NULL
   AND num_nonnulls(official_event_id, personal_event_id) = 1)
  OR
  (notification_type = 'announcement' AND announcement_id IS NOT NULL
   AND reminder_window IS NULL
   AND official_event_id IS NULL AND personal_event_id IS NULL)
)
```

The `notifications.personal_event_id` foreign key uses `ON DELETE SET NULL`; deleting a personal event therefore retains notification history without leaving a dangling reference.

Reminder idempotency includes recipient, event, window, and channel. Announcement idempotency includes recipient, announcement, and channel. Email fallback creates a distinct email row linked to the failed in-app row. Enrollment, mute, and preference eligibility is rechecked at send time. Group-targeted announcements notify only students in the matching group.

### `notification_delivery_logs`

`id uuid` primary key, `notification_id uuid` references `notifications`, `channel text not null`, `outcome text not null`, `reason_code text`, `destination_snapshot text`, and `created_at timestamptz not null default now()`.

This append-oriented operational log records delivery failures and skipped email fallbacks, including the absence of `users.email`. It is not user-facing notification state and must be retained according to operational observability policy.

## 5. FAQ

### `category_tags`

`id uuid` primary key and unique non-null `label`.

### `questions`

`id uuid` primary key, `author_id uuid not null` references `users`, `title text not null`, `body text not null`, `status enum` (`open`, `answered`, `resolved`) default `open`, `is_locked boolean not null default false`, nullable `hidden_at`, `edit_window_expires_at timestamptz not null`, and `created_at timestamptz not null default now()`.

### `question_tags`

Primary key `(question_id, category_tag_id)`, with foreign keys to `questions` and `category_tags`. Questions may have multiple controlled tags. During migration, copy any former single `questions.category_tag_id` value into this table before dropping that column.

### `answers`

`id uuid` primary key, `question_id uuid not null` references `questions`, `author_id uuid not null` references `users`, `body text not null`, `is_accepted boolean not null default false`, nullable `hidden_at`, and `created_at timestamptz not null default now()`. Partial unique index on `question_id` where `is_accepted = true`.

### `question_votes` and `answer_votes`

Each stores a user foreign key, target foreign key, `value enum` (`like`, `dislike`), and `updated_at`. Primary keys are `(user_id, question_id)` and `(user_id, answer_id)`. Deleting the row removes a vote.

### `reports`

`id uuid` primary key, `reporter_id uuid` references `users`, `target_type enum` (`question`, `answer`), `target_id uuid`, `reason text not null`, `status enum` (`open`, `resolved`) default `open`, and `created_at timestamptz not null default now()`. The polymorphic target is restricted to moderation use.

## 6. Profiles, Contact, and Office Hours

### `profiles`

`user_id uuid` primary key references `users`, nullable `photo_url`, and `verification_status enum` (`unverified`, `verified`) default `unverified`. Verification grant and revoke are audited and cannot be self-assigned.

### `contact_methods`

`id uuid` primary key, `user_id uuid not null` references `users`, `method_type enum` (`email`, `phone`, `office_location`, `other`), `value text not null`, `is_preferred boolean not null default false`, and `created_at timestamptz not null default now()`.

Multiple entries per method type are allowed. A partial unique index on `user_id` where `is_preferred = true` permits zero or one preferred method. `visibility_settings.contact_method` controls the full contact-method set.

### `visibility_settings`

Primary key `(user_id, field_name)`, with `field_name enum` (`real_name`, `username`, `email`, `contact_method`) and `visibility_level enum` (`public`, `course_members_only`, `private`). Missing rows use application defaults.

### `system_config`

`key text` primary key, `value text not null`, `updated_at timestamptz not null`, and `updated_by uuid` references `users`. The `campus_timezone` key is one admin-managed value; changes are audit-logged.

The `active_term` key is the canonical admin-managed current term used by enrollment and edit-eligibility checks. It must use the same semester format as `courses.term` and changes are audit-logged.

### `professor_schedule_documents`

`id uuid` primary key, `professor_id uuid not null unique` references `users`, nullable `file_url`, nullable `mime_type`, nullable `file_size_bytes`, nullable `uploaded_at`, and nullable `office_hours_summary`.

Supported formats are PDF, PNG, JPEG, DOC, DOCX, and Excel. The university-provided document is the authoritative office-hours record. One current document is retained per professor; a valid upload replaces it and exposes the last-updated timestamp. Office hours are not parsed into structured recurring rows in MVP; structured/queryable office hours remain on hold. Malware scanning, MIME/extension validation, and size limits occur before storage. The campus timezone is displayed from `system_config`.

## 7. Sessions and Authentication State

### `sessions`

`id uuid` primary key, `user_id uuid not null` references `users`, `token_hash text not null unique`, `created_at timestamptz not null default now()`, `last_active_at timestamptz not null default now()`, `idle_expires_at timestamptz not null`, `absolute_expires_at timestamptz not null`, nullable `step_up_verified_at`, `device_fingerprint text not null`, nullable `ip_country`, nullable `revoked_at`, and nullable `revoked_reason`.

The application generates a random opaque bearer token, gives it to the client in a protected cookie, and stores only an HMAC-SHA-256 token hash. Every validation checks `revoked_at IS NULL` before expiry or step-up freshness. Idle expiry slides by 14 days; absolute expiry is fixed at 30 days; privileged step-up freshness is 10 minutes. Role and account status are read live from `users`.

### `auth_attempts`

`id uuid` primary key, `client_fingerprint text not null`, nullable `client_ip_hash text`, nullable `account_user_id` references `users`, `outcome enum` (`domain_rejected`, `state_nonce_mismatch`, `account_blocked`, `succeeded`, `challenge_issued`, `challenge_passed`, `challenge_failed`), nullable `ip_country`, and `occurred_at timestamptz not null default now()`.

Rolling-window throttles and first-session risk baselines are application logic. OAuth state and nonce validation are mandatory. `client_ip_hash` is used for throttling without retaining a raw client IP in the application database.

### `challenges`

`id uuid` primary key, `auth_attempt_id uuid not null` references `auth_attempts`, nullable `account_user_id` references `users`, nullable `session_id` references `sessions`, `challenge_type enum` (`step_up`, `google_reauth`, `suspicious_login`) not null, `device_fingerprint text not null`, `purpose text not null`, `challenge_secret_hash text not null`, `issued_at timestamptz not null`, `expires_at timestamptz not null`, nullable `consumed_at`, and `failed_attempts smallint not null default 0`.

Challenges are short-lived server-side state for risky OAuth callbacks and privileged actions and are not stored in the append-only `auth_attempts` evidence record. The secret is generated server-side and only its hash is persisted. OAuth challenges bind to their initiating `auth_attempt_id` and device; authenticated step-up challenges bind to the current `session_id`, account, and intended `purpose`. Expired or consumed challenges are rejected. The first successful verification sets `consumed_at` atomically to prevent reuse; failed verification increments `failed_attempts` atomically and invalidates the challenge at five failures. Issuance, success, and failure continue to create `auth_attempts` records with outcomes `challenge_issued`, `challenge_passed`, and `challenge_failed`.

### `security_alerts`

`id uuid` primary key, nullable `user_id` references `users`, `alert_type enum` (`account_abuse_threshold`, `suspicious_signin`, `malware_scan_failure`), nullable `related_auth_attempt_id` references `auth_attempts`, `triggered_at timestamptz not null default now()`, and nullable `acknowledged_at`.

Challenge delivery and operations paging/email are outside the schema. Security alerts provide the durable record that an alert was emitted.

## 8. Account Deletion

### `deletion_requests`

`id uuid` primary key, `user_id uuid not null` references `users`, `status enum` (`pending`, `processing`, `completed`, `cancelled`) default `pending`, `requested_at timestamptz not null default now()`, nullable `completed_at`, nullable `cancelled_at`, nullable `legal_hold_reason`, and nullable `legal_hold_until`.

A partial unique index on `user_id` where status is `pending` or `processing` allows historical completed requests while preventing concurrent active requests. Processing must complete within 30 days by job/SLA enforcement.

On completion: one idempotent deletion job processes the request in fixed order, using one transaction for database operations where possible: legal-hold check, mark the request `processing`, revoke sessions, release claims, reassign historical authors and enrollments, clear notification references, hard-delete personal/profile/contact/document data, mark pending reviews `superseded`, anonymize the user in place, clear `users.deletion_requested_at`, and mark the request `completed`. Failed jobs leave the request retryable; a scheduled job retries pending or processing requests. Audit rows remain unchanged.

## Key Constraints and Policies

- `courses`: unique `(course_code, term)`.
- `course_groups`: unique `(course_id, group_label)` and `(id, course_id)`.
- `course_groups`: `professor_raw_name` is import text only; no capacity or professor identity foreign key is stored.
- `professor_teaching_claims`: at most one active claim per course group.
- `enrollments`: partial unique active enrollment per student/group; term is derived through the course group.
- `dataset_versions`: partial unique current version per term.
- `official_events`: unique dataset version, course group, event type, start time, and normalized location; end time must be after start time.
- `notifications`: unique idempotency key plus the notification-type check above.
- `answers`: partial unique accepted answer per question.
- `question_votes` and `answer_votes`: one vote per user per target.
- `professor_schedule_documents`: one current document per professor.
- `users`: unique Google subject, username, and present student/staff ID; one system placeholder.
- Course/group archival, official-data immutability, audit retention, notification retention, and authorization are enforced by application jobs, transactions, and infrastructure controls where noted.
