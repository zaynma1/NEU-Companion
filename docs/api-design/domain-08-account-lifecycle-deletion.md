# API Design: Account Lifecycle & Deletion

This is the eighth complete API design in the series. It is scoped to Domain 8 only and follows the requirements as the behavioral source of truth and the schema as the persistence source of truth.

## Domain scope

This domain covers:
- deletion request intake
- processing and SLA enforcement for account-deletion requests
- anonymization of user identity data while preserving immutable system history
- hard deletion of user-owned profile and contact data
- preservation of historical enrollment analytics through anonymized enrollment records
- retention of audit records and protected placeholder identity rules
- automated data export and data portability are deferred beyond MVP

This domain does not cover:
- authentication or session issuance
- course enrollment or timetable logic
- admin import lifecycle
- FAQ or announcement content management

## Actors

- Student
- Professor
- Admin

## Core principles

1. Rows are never hard-deleted from the main user table; the user is anonymized in place.
2. Deletion requests are single-active per user and cannot overlap.
3. Personal data is removed according to the schema’s completion rules.
4. Required audit data remains intact and immutable.
5. System placeholders protect the integrity of historical authored content and records.
6. Completed deletions are stored as historical state, not silently discarded.
7. A single idempotent job processes deletion requests in fixed order, and a scheduled job retries failures.

## Resource model

### DeletionRequest
The durable record of a user’s account removal request.

Key properties:
- id
- user_id
- status
- requested_at
- completed_at
- legal_hold_reason optional
- legal_hold_until optional

### User anonymization state
The user record is transformed but not removed from the main identity table.

Key properties:
- google_subject_id set to deleted:<uuid>
- full_name cleared
- username cleared or anonymized
- student_or_staff_id cleared or anonymized
- department cleared
- account_status set to deletion_pending or final anonymized state according to policy

## Public API surface

### 1. Request account deletion

POST /api/v1/account/deletion

Purpose:
- create a deletion request for the authenticated user

Request body:
- reason optional
- confirmation flag required

Validation:
- only the current user may request their own account deletion
- there must not already be a pending or processing request for that user
- reason is optional, but confirmation is required
- the current session must have fresh step-up verification within 10 minutes before the request is created
- set `users.deletion_requested_at` in the same transaction as the active deletion request

Response:
- created deletion_request record
- status: pending

### 2. Get deletion status

GET /api/v1/account/deletion

Purpose:
- fetch the user’s current deletion request state and remaining SLA/processing context

Response:
- request status
- requested_at
- completed_at if finished
- remaining processing state if still active

### 3. Cancel deletion request

POST /api/v1/account/deletion/cancel

Purpose:
- cancel a pending request if the product allows it

Validation:
- cancellation is only valid for pending requests
- cancellation requires fresh session-bound step-up verification within 10 minutes
- once processing begins, cancellation is rejected
- cancellation sets status to `cancelled` and records `cancelled_at`; the request row remains historical
- clear `users.deletion_requested_at` in the same transaction

### 4. Admin list deletion requests

GET /api/v1/admin/deletion-requests

Purpose:
- list deletion requests in operational review for admins

Authorization:
- admin only

### 5. Admin process deletion request

POST /api/v1/admin/deletion-requests/{requestId}/process

Purpose:
- trigger the completion flow for a deletion request or manually resume a queued job

Validation:
- request must be pending or processing, not completed
- system must enforce SLA and workflow guards
- this endpoint is treated as a manual override or operational trigger for an automated SLA job; it does not replace the background processing model
- legal hold must be cleared before the job can complete the deletion request
- the current session must have fresh step-up verification within 10 minutes before processing

Response:
- processing status
- completed_at

### 6. Place or clear legal hold

POST /api/v1/admin/deletion-requests/{requestId}/legal-hold

Purpose:
- block or release deletion processing while a legal or policy review is active

Request body:
- hold: true | false
- reason optional
- until optional timestamp

Validation:
- admin only
- hold blocks SLA completion jobs until it is explicitly lifted
- the current session must have fresh step-up verification within 10 minutes before placing or clearing a hold
- a hold must be auditable and associated with the admin actor

Response:
- status
- legal_hold_reason
- legal_hold_until

## Validation and behavioral rules

### Request rules
- a user may have only one active deletion request at a time
- `users.deletion_requested_at` is non-null exactly while an active deletion request exists
- fulfilled or completed requests remain historical and must not be reused
- admin must be able to inspect status without exposing full private user data

### Completion rules
- enrollments are reassigned to the protected anonymized placeholder while preserving term, course-group, status, and timestamps for historical analytics
- personal events are hard-deleted
- active professor teaching claims are released so a deleted account cannot continue authorizing announcements
- all active sessions are revoked before anonymization completes
- notifications referencing deleted personal events are retained with `personal_event_id` cleared
- questions, answers, and announcements remain with the author reassigned to the protected anonymized placeholder
- audit rows remain unchanged
- profiles, contact methods, visibility settings, notification preferences, and office-hours documents are hard-deleted
- muted course preferences are hard-deleted
- open pending-role review items are marked `superseded` before anonymization completes
- user record is anonymized in place
- legal hold blocks automatic SLA completion while a review or policy block is active

### Placeholder rules
- the protected placeholder identity is used only as an immutable author reference for historical content
- normal login, contact, and profile operations do not treat the placeholder as a real user

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
- deletion.request_exists
- deletion.not_found
- deletion.processing_locked
- deletion.invalid_state
- deletion.permission_denied

## Persistence contract mapping

This domain reads and writes the following persistence surfaces:
- deletion_requests
- users
- profiles
- contact_methods
- visibility_settings
- notification_preferences
- muted_courses
- professor_schedule_documents
- audit_log_entries
- enrollments
- personal_events
- personal_event_exceptions
- questions
- answers
- announcements
- professor_teaching_claims
- notifications
- sessions
- auth_attempts
- security_alerts
- notification_delivery_logs
- pending_review_items

The completion workflow is one idempotent deletion job. It processes a request in fixed order, uses one transaction for database operations where possible, leaves failed requests retryable, and is retried by a scheduled job. The job must not mark a request completed until all required operations succeed.

It must emit audit entries for:
- request creation
- request cancellation and processing outcomes
- user anonymization completion
- document access
- role and teaching-claim changes
- operational completion events

## Non-functional constraints

- deletion processing must be idempotent with respect to the request state
- process, legal-hold, and legal-hold-release actions require fresh session-bound step-up verification within 10 minutes
- the user record must never be fully removed from the main identity table
- SLA enforcement is operational, not merely UI logic
- a scheduled retention job purges audit records and integrity copies after the configured 180-day retention period
- completion flow must preserve the integrity of historical authored content and audit data

## Open design decisions

1. Should deletion-status retrieval include a countdown or only the state and timestamps?
2. Should a user be allowed to re-register or reuse their identity after anonymization, or is identity permanently preserved as history?
