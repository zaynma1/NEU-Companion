# API Domain Map

This document defines the API domain boundaries for the project after the requirements and contracts have been finalized.

Source of truth:
- Requirements: behavior, business rules, acceptance criteria, actor model
- Database design: persistence model, constraints, table ownership, invariants

## Design principles

1. Domains follow user-facing business capabilities, not database tables.
2. Authorization is a shared enforcement layer, not a standalone API domain.
3. Audit writes are side effects emitted by business flows, not a primary business domain.
4. Admin operational controls are grouped into one operational surface, but they do not own all writes to audit data.
5. Async vs sync execution is a route-design convention, not a domain boundary.
6. No requirement or schema changes are made unless a contradiction is identified.

## Domain 1: Authentication & Identity

Responsible for sign-in, sign-out, session lifecycle, onboarding, user-shell creation, and identity state.

Primary flows:
- Google OAuth login and allowed-domain enforcement
- session creation, idle/absolute expiry, and logout
- account switching re-auth flow
- onboarding and required first-login data capture
- identity anchoring via Google subject and user profile shell creation
- auth-attempt tracking and risk signal creation

Related persistence:
- users
- sessions
- auth_attempts
- challenges
- security_alerts

Configuration tables (read-only; managed by Domain 9 and deployment):
- allowed_email_domains
- role_assignment_rules

## Domain 2: Courses & Enrollment

Responsible for course catalog access and student enrollment to course groups.

Primary flows:
- listing available courses and term-specific groups
- enrolling in a course group
- dropping or switching groups within a term
- enforcing unique active enrollment rules

Related persistence:
- courses
- course_groups
- enrollments
- professor_teaching_claims

## Domain 3: Timetable & Personal Scheduling

Responsible for showing official academic events and managing personal schedule items.

Primary flows:
- reading official timetable for an enrolled course group
- viewing daily or weekly schedule layouts
- adding, editing, and removing personal recurring or one-off events
- identifying hard and soft conflicts with official events
- read-only access to official event details

Related persistence:
- official_events
- personal_events
- personal_event_exceptions
- enrollments
- course_groups


## Domain 4: Admin Import & Dataset Lifecycle

Responsible for the admin-controlled import, validation, diff review, publish, and rollback workflow.

Primary flows:
- Excel upload intake and validation
- row-level error reporting
- pre-commit diff summary
- publish/apply dataset version
- rollback to prior published version
- import retries and destructive-change confirmation

Related persistence:
- import_batches
- import_row_errors
- dataset_versions
- official_events

## Domain 5: Notifications & Announcements

Responsible for reminder generation, announcement delivery, notification feed behavior, preference management, and quieting rules.

Primary flows:
- schedule and dispatch reminders for official or personal events
- publish professor announcements to target course groups
- manage reminder/announcement preference state
- mute announcements by course
- mark notifications read/unread
- handle in-app delivery with email fallback and retry logic

Related persistence:
- notification_preferences
- muted_courses
- announcements
- notifications
- professor_teaching_claims
- notification_delivery_logs

## Domain 6: FAQ & Moderation

Responsible for user questions, answers, voting, tag-based search, and moderation workflows.

Primary flows:
- ask, answer, and resolve questions
- vote on questions and answers
- search and filter using tags and keywords
- accept a best answer
- report or hide problematic content
- enforce edit windows and locks

Related persistence:
- category_tags
- questions
- question_tags
- answers
- question_votes
- answer_votes
- reports

## Domain 7: Profiles, Contact & Office Hours

Responsible for profile data, contact methods, visibility, and professor office-hours documents.

Primary flows:
- create and update user profile information
- set preferred contact method and visibility rules
- read verification status for display
- upload or replace office-hours document
- search professor directory and read professor profiles and office-hours records

Related persistence:
- profiles
- contact_methods
- visibility_settings
- professor_schedule_documents

Verification grant/revoke is an admin-controlled mutation and belongs under Domain 9.

## Domain 8: Account Lifecycle & Deletion

Responsible for account deletion requests and the privacy lifecycle.

Primary flows:
- request account deletion
- process deletion within SLA
- anonymize or remove personal data in place
- preserve required audit records without recovering personal identifiers

Related persistence:
- deletion_requests
- users
- profiles
- contact_methods
- visibility_settings
- notification_preferences
- professor_schedule_documents
- audit_log_entries
- notifications
- sessions
- auth_attempts
- security_alerts
- professor_teaching_claims
- muted_courses
- enrollments
- personal_events
- personal_event_exceptions
- questions
- answers
- announcements
- notification_delivery_logs
- pending_review_items

## Domain 9: Admin Operations & System Controls

Responsible for admin operational surfaces that are not purely tied to a single business flow.

Primary flows:
- review and resolve pending-role decisions
- correct role assignments
- grant or revoke user verification status
- manage allowed email domains for OAuth sign-in
- view and manage system configuration
- view audit logs and security alerts
- inspect operational state for import and account security events

Related persistence:
- pending_review_items
- users
- profiles
- allowed_email_domains
- system_config
- audit_log_entries
- security_alerts
- professor_teaching_claims
- notification_delivery_logs

## Shared concerns (not standalone domains)

### Authorization middleware
Authorization is a cross-cutting enforcement layer. It validates whether the caller is allowed to read, write, or administer a resource at action time and data-read time.

This includes:
- least-privilege control
- role-based and resource-based checks
- pending-role restrictions
- professor ownership enforcement
- admin-only operational actions
- step-up re-auth checks for privileged operations

It is not modeled as its own API domain because it is invoked inside other domain routes rather than representing a separate user workflow.

### Audit write side effects
Audit writes are not owned by one feature domain. Business domains emit audit entries for material, disputed, or security-relevant state changes.

This includes:
- role changes
- imports and rollbacks
- verification grant/revoke
- account deletions
- document access
- teaching-claim changes
- security events
- configuration changes

The audit subsystem is best modeled as an operational concern that is called by domain services, not as a standalone domain surface.

### Security alerting
Security alerts are a durable record of operational events and are part of an admin/security control layer, but they are not a primary user-facing domain.

### Configuration: role inference rules
The `role_assignment_rules` table defines domain-pattern-based role inference logic used by Domain 1 authentication flow. This table is read-only from all API domains and is managed through admin database or deployment-time configuration, not through an API endpoint. No domain owns a CRUD surface for role_assignment_rules; they are referenced as read-only by Domain 1's business rule engine during sign-in.

### Route-design convention: async workflows
Async vs sync is not a domain boundary. It is a route and implementation convention for long-lived or queued work such as import processing, notification dispatch, or other background job flows.

This includes:
- status polling and progress endpoints
- retry semantics
- deduplication and idempotency keys
- job-trigger endpoints
- queue-driven processing boundaries

## Out of scope for this domain map

- Route naming or endpoint contracts
- HTTP method design
- DTO schemas
- implementation language or framework choices
- schema or requirement changes unless a contradiction is discovered

This map is meant to define the domain boundaries for the API before implementation work begins.
