# API Design: Notifications & Announcements

This is the fifth complete API design in the series. It is scoped to Domain 5 only and follows the requirements as the behavioral source of truth and the schema as the persistence source of truth.

## Domain scope

This domain covers:
- reminder generation and window evaluation
- professor announcements targeted to course groups
- preference toggles for reminders and announcements
- course-mute behavior for announcements
- notification feed queries and read state
- delivery channels, fallback, and idempotent retry logic

This domain does not cover:
- timetable import or dataset publication
- FAQ or moderation workflows
- profile or verification management
- auth/session lifecycle

## Actors

- Student
- Professor
- Admin

## Core principles

1. Notifications are only sent to the affected recipient set.
2. Reminder and announcement idempotency keys prevent duplicate sends across retries and channels.
3. Email is a fallback channel, not a replacement for in-app delivery.
4. Users can toggle reminders and announcements independently.
5. Course-level muting suppresses announcements only for that course.
6. Expired announcements are excluded from active feed queries.
7. Notification retention and active feed filtering are policy-controlled but read-time enforced.

## Resource model

### NotificationPreference
User-level toggle for reminder and announcement delivery preferences.

Key properties:
- user_id
- reminders_enabled
- announcements_enabled

### MutedCourse
User-level course suppression for announcements.

Key properties:
- user_id
- course_id

### Announcement
A professor-authored message targeted to a course group.

Key properties:
- id
- course_id
- course_group_id
- professor_id
- body
- published_at
- expiry_at
- created_at

### Notification
A reminder or announcement delivery record with status and channel metadata.

Key properties:
- id
- recipient_id
- notification_type
- official_event_id
- personal_event_id
- announcement_id
- reminder_window
- channel
- status
- reason_code
- idempotency_key
- triggered_by_notification_id
- read_at
- created_at
- delivered_at

## Public API surface

### 1. Get notification preferences

GET /api/v1/notifications/preferences

Purpose:
- fetch reminder and announcement toggle state for the current user

Response:
- reminders_enabled
- announcements_enabled

Authorization:
- authenticated user only

### 2. Update notification preferences

PUT /api/v1/notifications/preferences

Purpose:
- update reminder and announcement delivery preferences

Request body:
- reminders_enabled optional
- announcements_enabled optional

Validation:
- updates are limited to the authenticated user

Response:
- updated preference state

### 3. List muted courses

GET /api/v1/notifications/muted-courses

Purpose:
- list courses the user has muted from announcement delivery

Response:
- list of course objects or course ids with metadata

Authorization:
- authenticated user only

### 4. Mute or unmute a course

POST /api/v1/notifications/muted-courses

DELETE /api/v1/notifications/muted-courses/{courseId}

Purpose:
- add or remove a course from the user’s mute list

Authorization:
- current user only

### 5. Get notification feed

GET /api/v1/notifications

Purpose:
- fetch active notifications for the current user

Query parameters:
- unread_only optional
- type optional: reminder | announcement
- limit required, integer 1..200
- cursor optional

Response:
- notifications list
- unread_count
- pagination metadata

Authorization:
- user can only view their own notifications

### 6. Mark notification as read

POST /api/v1/notifications/{notificationId}/read

Purpose:
- mark a notification as read

Behavior:
- set read_at if not already set
- feed queries respect read state

Authorization:
- user must own the notification

### 7. Mark all notifications as read

POST /api/v1/notifications/read-all

Purpose:
- synchronously mark a bounded set of active notifications as read for the authenticated user

Request body:
- limit optional, integer 1..500; defaults to 500

Behavior:
- update at most `limit` unread notifications in one transaction
- order candidates deterministically by `created_at`, then `id`
- the response reports whether more unread notifications remain; the client may call the endpoint again

Response:
- marked_count
- has_more

Authorization:
- current user only

### 8. Publish announcement

POST /api/v1/announcements

Purpose:
- create a professor announcement targeted to a course group

Request body:
- course_id
- course_group_id
- body
- expiry_at optional

Validation:
- professor must have an active admin-assigned teaching relationship for the course group and an active professor account
- `course_id` must identify the course owning `course_group_id`
- course group term must equal `system_config.active_term` at publication time
- target audience is students enrolled in the matching group
- announcement count per course is subject to the daily cap
- message body must not be empty

Response:
- created announcement object
- published_at
- expiry_at if present

### 9. Get announcement detail

GET /api/v1/announcements/{announcementId}

Purpose:
- fetch a single announcement with active audience and expiry details

Response:
- announcement metadata
- professor snapshot
- course and group metadata
- expiry status

Authorization:
- user must be eligible to view the announcement

### 10. List announcements for a course group

GET /api/v1/course-groups/{groupId}/announcements

Purpose:
- list active announcements for a specific targeted group

Query parameters:
- include_expired optional
- limit required, integer 1..100
- cursor optional

Response:
- announcement list with publication and expiry timestamps

Authorization:
- students in the group and authorized professors may read them

### 11. Get delivery status for a notification

GET /api/v1/admin/notifications/{notificationId}/delivery-status

Purpose:
- inspect a specific notification record for operational troubleshooting

Response:
- channel
- status
- reason_code
- delivered_at
- retry metadata if tracked

Authorization:
- admin only

### 12. List failed or suppressed notifications

GET /api/v1/admin/notifications

Purpose:
- discover notification records requiring operational retry or investigation

Query parameters:
- status required: failed | suppressed
- notification_type optional
- channel optional
- recipient_id optional
- from, to optional
- limit required, integer 1..100
- cursor optional

Response:
- paginated notification summaries with notification id, recipient, channel, status, reason code, and timestamps

Authorization:
- admin only

### 13. Retry failed notification

POST /api/v1/admin/notifications/{notificationId}/retry

Purpose:
- trigger a retry of a failed or suppressed notification according to policy

Validation:
- only eligible notification states may be retried
- idempotency keys must prevent duplicate real deliveries

Authorization:
- admin only

## Validation and behavioral rules

### Delivery eligibility rules
- reminders are only created for affected recipients and relevant events
- announcements are only sent to students in the matching course group
- reminder notifications are suppressed when reminders are disabled for the recipient
- announcement notifications are suppressed when announcements are disabled for the recipient
- users with a muted course do not receive announcements for that course

### Announcement rules
- announcements target a specific course group and are not expanded to all groups in the same course
- expired announcements are excluded from active feed views
- the daily cap is shared across all targeted groups for a course and blocks additional publication attempts once reached

### Notification rules
- reminder idempotency includes recipient, official_event_id or personal_event_id, reminder_window, and channel
- announcement idempotency includes recipient, announcement_id, and channel
- email fallback uses `users.email` as its destination and creates a distinct email notification row linked to the failed in-app notification row
- if `users.email` is missing, the fallback is skipped with a recorded reason
- every delivery failure and fallback skip writes to the operational delivery log; no failure may be silent
- retry is governed by system policy and must not create duplicate deliveries
- enrollment, mute, preference, and active teaching-claim eligibility is rechecked at send time

### Notification type integrity
- reminder notifications must reference exactly one event and a valid reminder_window
- announcement notifications must reference an announcement_id and no reminder_window
- reminder types cannot also reference an announcement, and announcement notifications cannot include an official/personal event reference

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
- notification.not_found
- notification.not_owned
- notification.delivery_failed
- announcement.daily_cap_exceeded
- announcement.not_found
- announcement.expired
- validation.required_field_missing

## Persistence contract mapping

This domain reads and writes the following persistence surfaces:
- notification_preferences
- muted_courses
- announcements
- notifications
- professor_teaching_claims
- notification_delivery_logs

It must emit audit entries for:
- announcement publication and expiry changes
- failed or suppressed notification delivery
- admin retry actions

## Non-functional constraints

- idempotency keys must be deterministic for repeated retries
- every send must re-evaluate enrollment, mute, and preference state
- read-state synchronization across sessions and devices must be consistent
- retention and expiry filtering must be enforced at query time
- all list endpoints with unbounded result sets must require explicit limit/cursor parameters and enforce max page sizes
- bulk mark-all-read operations must be bounded to a maximum of 500 rows per request

## Open design decisions

1. Should the feed endpoint return only active notifications, or also include historical data when explicitly requested?
2. Should professor announcement creation support scheduling for a future time, or only immediate publication with optional expiry?
3. Delivery status is resolved as admin-only operational data; end users do not receive per-notification delivery-state details.
