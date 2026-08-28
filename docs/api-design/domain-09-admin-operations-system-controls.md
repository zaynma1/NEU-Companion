# API Design: Admin Operations & System Controls

This is the ninth complete API design in the series. It is scoped to Domain 9 only and follows the requirements as the behavioral source of truth and the schema as the persistence source of truth.

## Domain scope

This domain covers:
- pending-role review and final approval or rejection
- direct admin role correction or reassignment
- verification grant and verification revoke actions
- professor teaching-claim assignment and revocation
- operational configuration management
- audit-log inspection and security-alert review

This domain does not cover:
- public sign-in or user onboarding flows
- course enrollment or timetable editing
- FAQ moderation by end-user reporting
- user profile editing or contact methods

## Actors

- Admin
- Student
- Professor
- System operator

## Core principles

1. Admin operations are a separate boundary from user-facing business domains.
2. Pending review and role correction are not handled in Authentication or Profiles.
3. Verification grant/revoke is a controlled admin action, not a self-service profile action.
4. Audit entries are written for every material change and security-relevant or disputed denial.
5. Operational controls surface data read-only to the admin layer while updates remain tightly guarded.
6. System configuration is admin-managed and audit-logged.

## Resource model

### PendingReviewItem
A queue item for a user whose role decision still requires admin review.

Key properties:
- id
- user_id
- reviewer_id
- decision
- submitted_at
- due_by
- decided_at
- resolution_notes

### SystemConfig
Admin-configured platform setting.

Key properties:
- key
- value
- updated_at
- updated_by

### SecurityAlert
Durable operational alert for suspicious or abusive events.

Key properties:
- id
- user_id
- alert_type
- related_auth_attempt_id
- triggered_at
- acknowledged_at

### AuditLogEntry
Append-only system event record used for administrative investigation.

Key properties:
- id
- actor_id
- actor_label_snapshot
- action_type
- target_entity
- target_id
- before_value
- after_value
- created_at

## Public API surface

### 1. Search users

GET /api/v1/admin/users

Purpose:
- find users before applying role, account-status, or verification operations

Query parameters:
- q optional
- role optional
- account_status optional
- limit required, integer 1..100
- cursor optional

Response:
- paginated non-sensitive user summaries with id, display label, role, and account status

Authorization:
- admin only

### 2. List pending review items

GET /api/v1/admin/pending-review

Purpose:
- return all pending role-review items requiring admin attention

Authorization:
- admin only

Response:
- list of review items
- submission timestamp
- SLA due time
- reviewer assignment
- current decision state
- proposed_role

Query parameters:
- limit required, integer 1..100
- cursor optional

### 3. Decide pending review item

POST /api/v1/admin/pending-review/{itemId}/decision

Purpose:
- approve, reject, or reassign a pending review item

Request body:
- decision: approved | rejected | reassigned
- proposed_role optional for approvals
- resolution_notes optional
- reviewer_id optional for reassignment

Validation:
- decision is write-once after first resolution
- the submitting admin identity is recorded in the audit log
- role change is applied only if the decision is approved or reassigned according to policy
- `proposed_role` is required when decision is approved and must match the rule engine’s allowed role for that user
- approval and role update occur in one transaction; any other open review item for the same user is closed as superseded
- the current session must have fresh step-up verification within 10 minutes when the decision changes the user's role

### 4. Correct a user role

POST /api/v1/admin/users/{userId}/role

Purpose:
- grant or correct a user role directly

Request body:
- role: student | professor | admin
- reason optional

Validation:
- only admins may use this endpoint
- self-demotion is not allowed if the user would become the last active admin
- self-escalation is rejected when the actor targets their own account with a more privileged role; no direct self-escalation path exists outside the pending-review workflow
- the action is audit-logged
- role changes must be reconciled with pending review and account status checks
- the current session must have fresh step-up verification within 10 minutes before the change is applied
- any open pending-review item for the target user is atomically marked superseded, with the direct correction recorded as the authoritative decision

### 5. Correct a user account status

POST /api/v1/admin/users/{userId}/account-status

Purpose:
- suspend, block, or reactivate a user account

Request body:
- account_status: active | suspended | blocked
- reason optional

The system-managed `deletion_pending` status cannot be set through this endpoint; it is controlled only by the account-deletion workflow.

Validation:
- only admins may use this endpoint
- self-suspension or self-blocking is forbidden if it would remove the last active admin from the system
- a status change must immediately invalidate existing active sessions for that user unless the policy explicitly allows a grace window
- the current session must have fresh step-up verification within 10 minutes before the change is applied
- all writes are audit-logged

### 6. Grant verification

POST /api/v1/admin/users/{userId}/verification/grant

Purpose:
- mark a professor or admin profile as verified

Validation:
- caller must be admin
- target user must meet eligibility rules
- the current session must have fresh step-up verification within 10 minutes
- action is recorded in audit_log_entries and profile verification status

### 7. Revoke verification

POST /api/v1/admin/users/{userId}/verification/revoke

Purpose:
- remove verification status from a profile

Validation:
- admin only
- the current session must have fresh step-up verification within 10 minutes before the change is applied
- action is auditable
- user-facing profile representation is updated immediately

### 8. Manage professor teaching assignments

POST /api/v1/admin/teaching-claims

Purpose:
- assign or revoke a professor's course-group relationship after administrative review

Request body:
- professor_id
- course_group_id
- action: assign | revoke
- reason required

Validation:
- admin only
- the current session must have fresh step-up verification within 10 minutes
- for assignment, the target user must be an active professor and the course group must be in `system_config.active_term`
- for revocation, the assignment must exist
- the action is audit-logged and does not inspect or modify imported `professor_raw_name`

### 9. List system configuration

GET /api/v1/admin/system-config

Purpose:
- fetch the current admin-managed config values

Authorization:
- admin only

### 10. Update system configuration

PUT /api/v1/admin/system-config/{key}

Purpose:
- update an explicitly supported system config value such as `campus_timezone` or `active_term`

Request body:
- value

Validation:
- the key must be supported
- audit entry is required for every change
- config writes are restricted to admin actors
- the current session must have fresh step-up verification within 10 minutes
- `active_term` must use the same semester format as course terms and is the canonical value for active-term checks

### 11. List allowed email domains

GET /api/v1/admin/allowed-email-domains

Purpose:
- fetch the list of allowed Google OAuth email domains

Authorization:
- admin only

Response:
- paginated list of domains with `email_domain`, `allow_subdomains`, `created_at`, `updated_at`

Query parameters:
- limit required, integer 1..100
- cursor optional

### 12. Add allowed email domain

POST /api/v1/admin/allowed-email-domains

Purpose:
- add a new allowed email domain for OAuth sign-in

Request body:
- email_domain required (e.g., example.com)
- allow_subdomains optional, default false

Validation:
- admin only
- the domain must not already exist in the allowed list
- the current session must have fresh step-up verification within 10 minutes
- action is audit-logged
- at least one domain must remain in the allowed list at all times

### 13. Remove allowed email domain

DELETE /api/v1/admin/allowed-email-domains/{email_domain}

Purpose:
- revoke an allowed email domain, preventing new sign-ins from that domain

Request body:
- none

Validation:
- admin only
- the domain must exist
- the current session must have fresh step-up verification within 10 minutes
- action is audit-logged
- at least one domain must remain in the allowed list at all times

### 14. Update allowed email domain

PUT /api/v1/admin/allowed-email-domains/{email_domain}

Purpose:
- update subdomain inclusion policy for an allowed domain

Request body:
- allow_subdomains required, boolean

Validation:
- admin only
- the domain must exist
- the current session must have fresh step-up verification within 10 minutes
- action is audit-logged

### 15. List audit logs

GET /api/v1/admin/audit-logs

Purpose:
- inspect system actions for operational review and evidence gathering

Query parameters:
- target_entity optional
- actor_id optional
- action_type optional
- from, to optional
- limit required, integer 1..500
- cursor optional

Authorization:
- admin only

### 16. List security alerts

GET /api/v1/admin/security-alerts

Purpose:
- inspect active and acknowledged security alerts

Authorization:
- admin only

Query parameters:
- limit required, integer 1..100
- cursor optional

### 17. Acknowledge security alert

POST /api/v1/admin/security-alerts/{alertId}/acknowledge

Purpose:
- mark a security alert as acknowledged by an operator

## Validation and behavioral rules

### Review rules
- pending decisions are not self-service user actions
- decision is recorded once and cannot be rewritten without a new policy-driven workflow
- resolution notes are optional but recommended for accountability
- `proposed_role` must be stored or derived as part of a pending review item to make the approved role explicit

### Verification rules
- verification grant/revoke is never self-assigned by users
- verification status is system-visible only when the DB record is set accordingly
- audit entries must include before/after snapshots for verification transitions
- privileged admin actions must require fresh step-up verification within 10 minutes

### Administrative safety rules
- self-demotion or lockout is forbidden when it would leave the system without an active admin or without a valid admin quorum
- self-escalation outside the review queue is forbidden unless an explicit override flow is approved by policy
- admin demotion and lockout logic must be enforced within a transactional quorum check and row-level lock so concurrent demotions cannot race into a last-admin state
- pending-review decisions and direct role corrections use one transactional role-mutation service with row-level locking on the target user and open review items
- account status changes must invalidate any existing active sessions for the target user

### Configuration rules
- system config keys are explicitly enumerated and restricted to admin-managed values
- config updates are time-stamped and actor-linked
- every config change is backed by an audit entry

### Security state rules
- alert acknowledgement is operational and does not delete the underlying alert record
- security alerts count as durable event evidence, not ephemeral UI state
- audit payloads and actor labels must contain only approved non-PII fields; raw identity and profile fields are excluded

## Response model conventions

### Success response envelope
- status: success
- data: resource payload
- meta: request metadata if relevant

### Error response envelope
- status: error
- code: machine-readable code
- message: human-readable summary
- details: field or flow detail if needed

Example error codes:
- admin.forbidden
- admin.pending_review_not_found
- admin.invalid_decision
- admin.verification_immutable
- config.key_unknown
- audit.log_unavailable

## Persistence contract mapping

This domain reads and writes the following persistence surfaces:
- pending_review_items
- users
- profiles
- professor_teaching_claims
- allowed_email_domains
- system_config
- audit_log_entries
- security_alerts
- notification_delivery_logs

It must emit audit entries for:
- role changes
- verification transitions
- import or rollback review events
- allowed-domain policy changes
- config changes
- security alert acknowledgements
- teaching-claim changes

## Non-functional constraints

- operational endpoints are admin-only and must enforce authorization at the gateway or middleware level
- audit writes must be append-only and tamper-resistant
- warning/alert surfaces must treat active and historical records separately
- config writes require strong validation so unknown keys or invalid values cannot enter the system

## Final note

This completes the approved nine-domain API map. The architecture respects the source-of-truth documents and keeps admin operational controls in a dedicated domain while treating audit as a shared side effect rather than a primary business domain.
