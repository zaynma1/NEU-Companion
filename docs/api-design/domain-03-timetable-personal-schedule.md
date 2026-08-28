# API Design: Timetable & Personal Scheduling

This is the third complete API design in the series. It is scoped to Domain 3 only and follows the requirements as the behavioral source of truth and the schema as the persistence source of truth.

## Domain scope

This domain covers:
- reading official timetable data for the student’s enrolled groups
- viewing official events in day or week layout
- creating and managing personal schedule items
- recurring personal items with end-date support
- conflict detection between official and personal items
- read-only official event detail views

This domain does not cover:
- course enrollment lifecycle
- admin import/rollback workflow
- reminder or notification dispatching
- announcement creation
- FAQ or profile flows

## Actors

- Student
- Professor
- Admin

## Core principles

1. The official timetable is derived from the student’s enrolled course groups and is read-only to students and professors in MVP.
2. All datetime values are stored in UTC and rendered in campus timezone.
3. Blank official locations are displayed as TBA consistently.
4. Personal items are isolated to the user and visually distinct from official items.
5. Conflict detection is advisory and must distinguish hard and soft conflict severity.
6. Official timetable changes do not delete or modify personal schedule items.
7. Personal recurring events are bounded by a future horizon for system performance.
8. `personal_events` is defined in the persistence document as a user-owned schedule entity and is required for this API.
9. Recurring personal-event update and delete operations must support scope semantics: this occurrence, this and future occurrences, or the entire series.
10. The recurrence horizon for personal events is capped and must reject limit-exceeded cases with `personal_event.recurrence_horizon_exceeded`.

## Resource model

### OfficialEvent
A canonical timetable event imported by admins.

Key properties:
- id
- course_group_id
- event_type
- start_datetime
- end_datetime
- location
- dataset_version_id

### PersonalEvent
A civil/personal schedule item owned by a user.

Key properties:
- id
- user_id
- title
- description
- start_datetime
- end_datetime
- is_recurring
- recurrence_rule
- recurrence_end_date
- location
- event_type
- created_at
- updated_at

### Calendar conflict
A derived validation result representing whether a personal item overlaps an official event.

Key properties:
- severity
- event_id
- source_type
- start_datetime
- end_datetime
- title
- location

## Public API surface

### 1. Get student timetable

GET /api/v1/timetable

Purpose:
- return the official timetable for the current student across their enrolled group memberships

Query parameters:
- term optional
- start_date
- end_date
- course_group_id optional
- view optional: day | week | month

Response:
- list of official events with normalized display dates in campus timezone
- each event includes course, group, title, time, location or TBA, event type

Authorization:
- student only for their own timetable
- professor may view their assigned timetable subset under professor rules

### 2. Get official event details

GET /api/v1/official-events/{eventId}

Purpose:
- provide a read-only detail view for an official event

Response:
- event metadata
- course and group details
- lecture or exam info
- date/time in campus timezone
- location or TBA

Authorization:
- student must be enrolled in the event's course group, professor must have an active teaching claim for the group, or caller must be an authorized admin
- editing is not exposed in this API

### 3. Get my personal schedule

GET /api/v1/personal-events

Purpose:
- list personal calendar items owned by the current user

Query parameters:
- start_date
- end_date
- includeRecurrences optional
- status optional

Response:
- list of personal events with computed recurrence instances if requested

Authorization:
- user can only access their own personal events

### 4. Create personal event

POST /api/v1/personal-events

Purpose:
- create a one-off or recurring personal schedule item

Request body:
- title
- description optional
- start_datetime
- end_datetime
- location optional
- event_type optional
- is_recurring boolean
- recurrence_rule optional
- recurrence_end_date optional

Validation:
- no end before start
- recurring item must have valid recurrence_end_date within allowed horizon
- item ownership is always current user
- personal event creation cannot modify official events

Response:
- created personal event record
- computed conflict payload if relevant

### 5. Update personal event

PUT /api/v1/personal-events/{eventId}

Purpose:
- update a user-owned personal event

Request body:
- any editable fields for the event
- scope required when the target is recurring: this_occurrence | this_and_future | entire_series; omit for one-off events

Validation:
- target must belong to current user
- changes cannot affect official timetable records
- if recurrence is modified, update end-date and recurrence semantics consistently
- `this_occurrence` writes an exception row; `this_and_future` splits the series at the selected occurrence and creates a new series; `entire_series` updates the base series

Response:
- updated personal event
- next conflict result set if applicable

### 6. Delete personal event

DELETE /api/v1/personal-events/{eventId}

Purpose:
- remove a personal event or recurring event series

Behavior:
- delete is user-owned only
- for recurring events, `scope` is required and determines whether this occurrence, this and future occurrences, or the entire series is removed
- `this_occurrence` creates a cancelled exception, `this_and_future` shortens the current series, and `entire_series` removes the series and its exceptions

Authorization:
- user must own the event

## Response model conventions

### Success response envelope
- status: success
- data: resource or action payload
- meta: request metadata if relevant

### Error response envelope
- status: error
- code: machine-readable code
- message: human-readable summary
- details: field or operation detail when needed

Example error codes:
- timetable.event_not_found
- timetable.event_not_owned
- personal_event.recurrence_horizon_exceeded
- personal_event.invalid_scope

## Persistence contract mapping

This domain reads and writes:
- official_events
- personal_events
- personal_event_exceptions
- enrollments
- course_groups

Personal-event deletion and disputed conflict decisions must emit audit entries; routine personal-event changes and successful authorization checks do not.

### 7. Check conflicts for a personal event

POST /api/v1/personal-events/conflicts

Purpose:
- validate a personal event against existing official timetable events before save

Request body:
- start_datetime
- end_datetime
- recurrence_rule optional
- recurrence_end_date optional
- title optional
- location optional

Response:
- array of conflict objects
- severity: hard | soft
- related official event metadata
- conflict reason

Authorization:
- authenticated user only

### 8. List official events for a course group

GET /api/v1/course-groups/{groupId}/official-events

Purpose:
- fetch events for a specific group without needing a full timetable view

Query parameters:
- start_date
- end_date
- term optional

Response:
- list of official events for that group

Authorization:
- requires access to the relevant group or course membership

### 9. Get timetable summary for a day/week

This endpoint is intentionally excluded from the MVP API surface because the requirements do not define it as a required behavior and it duplicates the data already available via the core timetable endpoint. If product demand emerges later, it should be added as a deliberate API expansion rather than as part of the base contract.

## Schema note

The persistence document defines `personal_events` as a user-owned calendar entity. The API and notification contracts must preserve that ownership boundary.
