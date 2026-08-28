# API Design: Courses & Enrollment

This is the second complete API design in the series. It is scoped to Domain 2 only and follows the requirements as the behavioral source of truth and the schema as the persistence source of truth.

## Domain scope

This domain covers:
- listing available courses and course-group options
- student enrollment in a specific course group
- dropping or switching course groups within the active term
- enforcing active enrollment rules and course-group uniqueness
- professor teaching claims and admin-managed assignments used by announcement authorization
- course membership lookup for downstream features like timetable and announcements

This domain does not cover:
- timetable rendering or schedule conflict logic
- notification or announcement dispatch
- admin import workflow
- FAQ, profile, or account deletion flows

## Actors

- Student
- Professor

## Core principles

1. The source of truth for membership is the selected course group, not the course alone.
2. Students may hold active enrollments in multiple groups of the same course.
3. Duplicate active enrollment in the same group and term is prevented.
4. Group switching is a soft-drop plus a new active enrollment, not a silent replacement.
5. Course-group and term identity are immutable once official events exist.
6. Read access for archived terms is allowed, but edit flows remain limited to active-term logic.

## Resource model

### Course
A canonical academic offering for a term.

Key properties:
- id
- course_code
- term
- title
- department
- created_at

### CourseGroup
A specific section or variant within a course and term.

Key properties:
- id
- course_id
- group_label
- professor_raw_name
- is_archived

### Enrollment
A student membership record in a course group for a given term.

Key properties:
- id
- student_id
- course_group_id
- term
- status
- enrolled_at
- dropped_at

## Public API surface

### 1. List available courses

GET /api/v1/courses

Purpose:
- list course offerings for a selected term or current academic context

Query parameters:
- term optional
- department optional
- search optional
- limit required, integer 1..100
- cursor optional

Response:
- list of courses with summary fields
- course code, title, term, department

Authorization:
- authenticated users may view the catalog

### 2. Get course details

GET /api/v1/courses/{courseId}

Purpose:
- fetch a specific course and its group options

Response:
- course metadata
- group list with labels and professor info as allowed by policy
- enrollment status for current user if applicable

Authorization:
- any authenticated user can view available course metadata
- visibility of professor metadata is subject to profile permissions

### 3. List groups for a course

GET /api/v1/courses/{courseId}/groups

Purpose:
- fetch all groups for the course in the selected term

Response:
- each group includes id, group_label, professor_raw_name, archived flag
- current user membership state for each group

Authorization:
- requires valid authenticated session

### 4. Get current enrollment summary

GET /api/v1/enrollments

Purpose:
- fetch the current user’s active and historical enrollments

Query parameters:
- term optional
- status optional
- includeArchived optional

Response:
- list of enrollment records with course and group metadata
- status and enrollment timestamps

Authorization:
- user can only see their own enrollments

### 5. Enroll in a group

POST /api/v1/enrollments

Purpose:
- enroll the current student in a specific course group for a term

Request body:
- course_group_id

Validation:
- the server resolves `term` from `course_group_id` and ignores any client-supplied term value
- course group must exist and belong to the selected term
- course group term must equal the canonical `system_config.active_term`
- user must be an active student account
- no duplicate active enrollment for the same student + course_group + term
- group cannot be archived for active enrollment in normal user flows
- enrollment is unrestricted; no capacity check is performed

Response:
- created enrollment record
- status: active
- created_at

Authorization:
- student only
- must be current user’s own enrollment action

### 6. Drop enrollment

POST /api/v1/enrollments/{enrollmentId}/drop

Purpose:
- soft-drop an active enrollment while preserving history

Request body:
- reason optional

Behavior:
- marks the enrollment status as dropped
- records dropped_at
- does not delete historical enrollment data

Authorization:
- student may drop their own enrollment

### 7. Switch group

POST /api/v1/enrollments/switch

Purpose:
- move a student from one active group to another within the same course and term

Request body:
- from_enrollment_id
- to_course_group_id

Behavior:
- soft-drop current active enrollment
- create new active enrollment in the target group
- preserve the old row for historical linkage and auditability

Validation:
- the server resolves `term` from the source and target course groups and rejects mismatches before writing
- target group must be in the same course and term as the source if the product requires same-course switching
- source enrollment must be active
- source and target course-group terms must equal the canonical `system_config.active_term`
- no duplicate active row is created for same student/group/term

Response:
- previous enrollment updated to dropped
- new enrollment created as active

Authorization:
- student only for own enrollment transition

### 8. Get enrollment eligibility for a course/group

GET /api/v1/courses/{courseId}/groups/{groupId}/eligibility

Purpose:
- return whether the current user can join or remain in a group

Response:
- eligible / ineligible
- reason codes if denied

Possible reason codes:
- already_enrolled
- group_archived
- term_inactive
- not_student_account

Authorization:
- authenticated user only

### 9. List my active course memberships

GET /api/v1/students/me/courses

Purpose:
- return the current student’s active course-group memberships for timetable and announcement targeting

Response:
- list of course_group_id, course metadata, group metadata, term

Authorization:
- student only for own state

### 10. Claim a course group for teaching

POST /api/v1/professor/teaching-claims

Purpose:
- allow a professor to self-assign an imported course group for targeted announcement authorization

Request body:
- course_group_id

Validation:
- professor role and active account are required
- course group must exist and not be archived
- course group term must equal `system_config.active_term`
- only one active claim may exist for a course group
- a second active claim attempt is rejected with `teaching_claim.already_claimed`
- the claim is an auditable action and does not modify `professor_raw_name`

MVP risk acceptance:
- an active claim grants announcement authority without automated identity matching against `professor_raw_name`
- this accepted risk is mitigated by one-claim-per-group enforcement, audit logging, and admin assignment or revocation

### 11. Release a teaching claim

DELETE /api/v1/professor/teaching-claims/{claimId}

Purpose:
- release the current professor's active claim for a course group

Authorization:
- owning professor only

### 12. List my teaching claims

GET /api/v1/professor/teaching-claims

Purpose:
- list the authenticated professor's active and released teaching claims and admin assignments

Query parameters:
- status optional: active | released
- limit required, integer 1..100
- cursor optional

Authorization:
- current professor only

## Persistence contract mapping

This domain reads and writes:
- courses
- course_groups
- enrollments
- professor_teaching_claims

Teaching-claim creation, release, admin assignment, revocation, conflict rejection, and other relationship mutations are audit-logged.
