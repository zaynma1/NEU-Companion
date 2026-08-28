## Plan: MVP Requirements Baseline

This document finalizes product requirements first, in module order, with testable acceptance criteria and explicit scope limits. Database design starts only after all modules are approved.

**Product Goals (MVP)**
1. Help engineering students reliably see lectures, exams, locations, and deadlines in one place.
2. Reduce missed academic events through reminders and professor announcements.
3. Make course materials, professor contact details, and onboarding information easy to find.

**Actors**
1. Student
2. Professor
3. Admin

**MVP Scope Boundaries**
1. Included: Google sign-in with allowed domain(s), role-based access, timetable view, personal events, reminders, FAQ basics, profile/contact info, admin Excel upload.
2. Excluded: full automatic external sheet polling, threaded discussions, advanced moderation, analytics features.

**Foundational Data and Integrity Requirements (MVP)**
1. Enrollment source-of-truth in MVP is user-selected course groups, and timetable visibility plus professor announcement targeting use this enrollment record.
2. System assigns immutable primary identifiers to courses, course groups, official events, personal events, import batches, notifications, and FAQ items.
3. Official timetable event uniqueness is enforced within each published dataset version by course group, event type, start datetime, and normalized location; blank locations are treated as NULL/TBA, and event end time must be after start time.
4. Datetime values are stored in UTC and rendered in campus timezone, including daylight-saving transitions where applicable.
5. Import apply and rollback use atomic dataset swap so student reads never return mixed pre-change and post-change term data.
6. Notification records include statuses of queued, delivered, failed, and suppressed with reason code and timestamps.
7. Reminder and announcement dispatch use deterministic idempotency keys to prevent duplicate sends across retries and channels.
8. Role-permission policy is defined as a resource-action matrix and enforced consistently across API and UI; the matrix is maintained as documentation and reviewed with endpoint changes.
9. Pending-role accounts enter an admin review queue with decision audit log and configurable resolution SLA.
10. Account deletion performs irreversible deletion or anonymization of personal identifiers while retaining required audit records in de-identified form; one idempotent job processes the request in fixed order and a scheduled job retries failures.
11. Notification records distinguish reminders from announcements; reminders reference exactly one event and a reminder window, while announcements reference exactly one announcement.
12. Campus timezone is stored as one admin-managed, audited system configuration value and is used for display and reminder calculations.
13. Professor announcements target a specific assigned course group; they are not automatically expanded to every group in the course.
14. Enrollment is unrestricted in MVP; course groups do not enforce capacity.
15. Professor course-group assignment uses self-service teaching claims; admins can also assign or revoke professor course-group relationships. Imported professor names remain raw informational text and are never automatically linked to user accounts.
16. `system_config.active_term` is the canonical term for enrollment and active-term edit checks.
17. Recurring personal-event occurrence changes and cancellations are persisted as event exceptions.
18. A pending account-deletion request may be cancelled, remains as historical state with status `cancelled`, and records its cancellation timestamp.
19. Import batches that remain incomplete in `validating` beyond the configured validation timeout or retention window become `expired`; terminal batches are not expired.
20. Device risk and authentication throttling use a server-controlled non-PII device binding and privacy-preserving client-IP representation; clients cannot choose their authoritative fingerprint.

**Foundational Acceptance Criteria**
1. Given course group enrollment changes, when timetable and announcement audience are evaluated, then only current enrollment records are used.
2. Given duplicate official-event key combinations, when import validation runs, then conflicting records are rejected.
3. Given term import apply or rollback, when student timetable is queried, then response reflects one consistent dataset version.
4. Given reminder retries across channels, when duplicate dispatch condition occurs, then idempotency keys prevent duplicate delivery.
5. Given pending-role account creation, when admin review is performed, then decision, reviewer, and timestamp are audit logged.
6. Given account deletion request completion, when historical audit logs are queried, then personal identifiers are not recoverable from retained audit data.

**Module 1: Authentication and Identity**
1. Users sign in using Google OAuth.
2. Only users from approved email domain(s) can access the system.
3. Domain policy is explicit and configurable, including whether subdomains and alumni domains are allowed.
4. Users can log out and switch accounts.
5. System assigns role using configured rules and supports admin role correction.
6. If role cannot be inferred safely, user is assigned Pending role until admin confirms.
7. Identity is anchored to Google subject identifier, not email string, to avoid identity drift after email changes.
8. After verifying the Google ID token, the system uses its `given_name` and `family_name` claims for the user's first and last name; it derives the student/staff number from the email local part only when the verified email domain is `@std.neu.edu.tr` (students: email local part is student ID) or `@neu.edu.tr` (staff: email local part format is firstname.lastname).
9. The OAuth flow requests only the `openid`, `email`, and `profile` scopes needed for identity and onboarding, presents Google’s consent screen and the application privacy notice, and does not persist raw tokens.
10. If the verified ID token lacks usable name claims or the email local part does not match an approved student/staff identifier format, the system prompts for the missing required first-login fields: full name, student or staff ID, and department; user-supplied values require confirmation before being saved.
11. Account status states include Active, Suspended, and Blocked with enforced login behavior.

**Module 1 Business Rules**
1. Access denied for disallowed domain(s) with clear reason.
2. Denied access screen includes a request-access contact path.
3. First login creates user profile shell.
4. Pending role users can access only minimal onboarding screens until role is confirmed.
5. Suspended and blocked users cannot create active sessions.
6. Repeated failed authentication attempts from same client are rate-limited.
7. Risky sign-ins return an explicit `challenge_required` outcome and cannot create a normal authenticated session until the challenge succeeds. Challenges are bound to the initiating OAuth attempt or current session, account, server-controlled device fingerprint, and intended purpose; only a hash of the server-issued challenge secret is stored.
8. Role and account status changes are audit-logged by admin action.

**Module 1 Acceptance Criteria**
1. Given a disallowed domain account, when login completes, then access is denied and user sees rejection message and request-access path.
2. Given an allowed domain account, when login completes, then user lands on role-appropriate home view.
3. Given ambiguous role mapping, when first login completes, then user is marked Pending and restricted until reviewed.
4. Given signed-in user switching account, when switch is completed, then previous session is ended and new identity is active.
5. Given suspended or blocked user, when login is attempted, then access is denied with account status reason.
6. Given repeated failed sign-in attempts, when threshold is reached, then additional attempts are temporarily throttled.
7. Given a risky sign-in, when OAuth callback risk checks match, then the callback returns `challenge_required` and no normal session is created until verification succeeds.
8. Given an expired, consumed, or five-times-failed challenge, when verification is attempted, then it is rejected and cannot be reused.
9. Given a cookie-authenticated state-changing request, when the CSRF token is missing or the `Origin` is not configured, then the request is rejected.

**Module 1 Decision (Locked)**
1. Account switching re-auth flow: application does not collect or store passwords directly.
2. MVP behavior: show recent signed-in emails for convenience and use Google OAuth re-auth for account switching.

**Module 2: Roles and Permissions**
1. Students can view official timetable items and manage personal schedule items.
2. Professors can publish announcements to students enrolled in their assigned courses.
3. Admins can manage imports and correct user roles.
4. Students cannot edit official timetable records.
5. Pending-role users cannot access student or professor feature actions.

**Module 2 Business Rules**
1. Official schedule is immutable to student and professor roles in MVP, while admin import and rollback remain authorized update paths.
2. Personal schedule is user-owned and isolated.
3. Least-privilege default applies: new accounts start with pending-restricted access until role is confirmed.
4. Permission checks apply at action time and data-read time.
5. Professor write permissions are limited to active teaching claims for course groups in the active term.
6. Professors can claim imported course groups through an auditable teaching-claim record, and admins can assign or revoke those relationships; imported professor names are not used to establish the relationship.
7. Role changes propagate immediately across active sessions.
8. Users can view archived terms, but edits are allowed only in active term.
9. Permission-denied write attempts are denied consistently; audit logging is reserved for disputed or security-relevant mutations and document access.

**Permission Matrix (MVP)**

| Resource / action | Student | Professor | Admin | Conditions |
|---|---|---|---|---|
| View own profile, contacts, visibility, schedule, notifications | Yes | Yes | Yes | Own records only |
| View visible professor profile or office-hours document | Yes | Yes | Yes | Field visibility and private signed-download authorization apply |
| Enroll, drop, or switch course group | Yes | No | No | Own enrollment; course-group term equals `active_term` |
| Claim teaching group | No | Yes | No | Active account; group term equals `active_term`; one active claim |
| Assign or revoke teaching group | No | No | Yes | Admin assignment/revocation; active professor account; group term equals `active_term`; one active claim |
| Publish announcement | No | Yes | No | Active teaching claim, matching course/group, active term, enrolled audience |
| Manage imports, roles, verification, configuration, deletion processing | No | No | Yes | Admin authorization; fresh step-up for privileged actions |
| Ask, answer, vote, report, and manage own FAQ content | Yes | Yes | Yes | Workflow state, ownership, and moderation rules apply |

The matrix is the canonical role baseline. Endpoint-specific ownership, visibility, active-term, claim, and step-up conditions narrow access further. Code review is the enforcement process; no separate CI citation check is required for MVP.

**Module 2 Acceptance Criteria**
1. Given a student, when attempting to edit official lecture time, then action is blocked.
2. Given a professor without an active teaching claim, when targeting a course group for announcement, then action is blocked.
3. Given a new account without confirmed role, when accessing protected actions, then only pending-restricted screens are available.
4. Given an admin role change, when action completes, then new permissions apply immediately.
5. Given archived term data, when viewed, then read is allowed and edits are blocked.

**Module 3: Courses and Timetable**
1. Students can add courses from available course list.
2. Course selection supports group variants, such as MTH102A and MTH102B.
3. Official timetable events shown to a student are derived from selected course group.
4. Students can view timetable by day and week.
5. Timetable includes lecture, exam, and hall or location fields.
6. If official location is missing, timetable shows TBA consistently.
7. Students can add personal schedule items, including weekly recurring items with end date.
8. Personal items are visually distinct from official schedule items.
9. Students can open official event details in read-only mode.

**Module 3 Business Rules**
1. Duplicate enrollment for same course group and term is prevented.
2. Official event times are stored in UTC and displayed in campus timezone for MVP.
3. Time conflicts between official and personal items are flagged to user.
4. Conflict severity uses hard and soft categories in MVP.
5. Official data updates do not delete personal items.
6. Course add and drop is unrestricted within active term in MVP.
7. Personal recurring events are capped to a maximum future horizon for performance.
8. Course groups do not enforce enrollment capacity in MVP.
9. Enrollment, drop, and group-switch mutations are allowed only when the relevant course-group term equals `system_config.active_term`.
10. Recurring event updates and deletions require one of `this_occurrence`, `this_and_future`, or `entire_series`; each scope has the corresponding exception, series-split, or full-series behavior.

**Module 3 Acceptance Criteria**
1. Given enrolled course groups, when opening timetable, then only matching group events are visible with time and location or TBA.
2. Given a personal recurring item within allowed horizon, when saved, then recurrence instances appear until end date.
3. Given recurring request beyond allowed horizon, when saved, then user gets clear limit message.
4. Given a personal item overlapping official event, when saved, then conflict warning is shown with hard or soft severity.
5. Given official timetable update import, when refresh occurs, then personal items remain unchanged.
6. Given official event details opened by student, when viewed, then fields are visible and not editable.

**Module 4: Admin Schedule Import (Excel)**
1. Only admins can upload or rollback imports.
2. Admin uploads supported Excel file for lectures and exams.
3. System validates template version before parsing data.
4. System validates file format and field-level data before applying changes.
5. Import targets an explicit term and cannot overwrite other terms.
6. Duplicate rows in one file are rejected and validation fails.
7. System shows pre-commit diff summary before final apply.
8. Re-importing the same file should be idempotent.
9. System stores import result summary.
10. Admin can compare and rollback to any prior successful published import version for the selected term.
11. System requires destructive-change confirmation when an import would remove many events.

**Module 4 Business Rules**
1. Invalid rows are rejected with row-level reasons.
2. Import apply and rollback are atomic at batch level and use dataset swap semantics for consistent reads in MVP.
3. Latest successful import timestamp is visible to admin.
4. Validation covers course code, group, date and time, and location fields.
5. Term uses semester format and scope, such as Fall 2026, Spring 2027, or Summer 2027.
6. Import actions and rollbacks are audit-logged.
7. Each successful import creates an immutable dataset version identified by version_id; rollback can target any prior published version for the selected term and creates a new audit-logged publication event.
8. Import enforces maximum file size and maximum row count limits.
9. Import processing has timeout threshold and supports admin retry after timeout.
10. An identical content hash for the same term cannot create a duplicate published dataset version, including under concurrent apply requests.

**Module 4 Acceptance Criteria**
1. Given non-admin user, when attempting import or rollback, then action is blocked.
2. Given malformed or wrong-template file, when upload starts, then import is rejected with error report.
3. Given file over size or row limits, when validation runs, then import is blocked with limit error.
4. Given file containing duplicate rows, when validation runs, then import is blocked with duplicate row errors.
5. Given valid file for a specific term, when pre-commit summary is shown, then add, update, and removal counts are displayed.
6. Given same file imported again, when import runs, then no duplicate timetable changes are created.
7. Given import timeout, when admin retries with corrected load conditions, then system allows retry attempt.
8. Given completed import, when admin views logs, then success and failure counts are shown.
9. Given any prior published import version, when an authorized admin rolls back to its version_id, then that version is restored atomically without deleting existing versions.

**Admin Configuration (MVP)**
1. Admins can view and update supported system configuration values, including `campus_timezone` and `active_term`; `active_term` uses the same semester format as course terms and is the canonical value for active-term checks.

**Module 5: Notifications and Announcements**
1. System supports reminder timings at 1 day, 3 hours, and 1 hour before due time, plus at due time.
2. Users can toggle reminder notifications and professor announcements independently.
3. Users can mute announcements by course.
4. Professors can send course announcements to enrolled students.
5. Professors can set announcement expiry date.
6. Students receive notification feed with unread and read state.
7. Delivery channels in MVP are in-app plus email fallback, and notification records support both reminders and announcements.

**Module 5 Business Rules**
1. Notifications are only sent to affected users.
2. Reminder windows are computed consistently using event timezone rules.
3. Email acts as fallback channel using `users.email`: if in-app delivery succeeds, email is optional; if in-app delivery fails and `users.email` is present, email fallback is attempted; if it is missing, fallback is skipped and the reason is recorded in the operational delivery log.
4. If primary delivery fails, event is retried according to system retry policy.
5. Duplicate notification for the same reminder window, or the same announcement and channel, is prevented.
6. Daily announcement rate cap applies per course to reduce spam.
7. Expired announcements are excluded from active notification views.
8. Notification feed retention window is fixed and configurable.
9. Read and unread state is synchronized across user devices and sessions.
10. Announcement muting is only available at course level; professors cannot mute individual users or groups.
11. Announcement detail and list reads require current eligibility: students must be enrolled in the matching course group, professors must have the applicable teaching authorization, and expired announcements are excluded from active results.

**Module 5 Acceptance Criteria**
1. Given a scheduled event, when reminder windows are reached, then notifications appear once per window using correct timezone.
2. Given reminders disabled for a user, when reminder window is reached, then reminder is not delivered for that type.
3. Given announcement posting beyond daily cap, when professor submits, then publication is blocked with limit message.
4. Given professor announcement with expiry, when expiry passes, then announcement is no longer active in feed.
5. Given muted course, when professor publishes announcement, then muted user does not receive that course announcement.
6. Given notification marked read on one device, when user opens another device session, then read state matches.
7. Given notification older than retention window, when feed is queried, then it is excluded from active history.

**Module 6: FAQ**
1. Students and professors can submit questions; anonymous submissions are excluded from MVP because question and answer authors are required.
2. Students and professors can submit answers.
3. Questions and answers support like and dislike counters.
4. No nested replies in MVP.
5. FAQs support search and category tags.
6. FAQs support sorting by recency and popularity.
7. Questions support workflow states: open, answered, and resolved.
8. Askers can mark their own questions as resolved.
9. Content can be reported for moderation.
10. Askers can edit questions within a limited edit window.
11. One answer can be marked as accepted.

**Module 6 Business Rules**
1. Votes are one per user per item and can be changed; users cannot vote on their own questions or answers.
2. Deleted or hidden content is removed from default search results.
3. Tags are selected from a controlled list in MVP, and each question may have multiple tags.
4. Reported content can be hidden by moderation action.
5. Edit window duration is fixed and configurable.
6. Resolved questions are locked for new answers by default and can be reopened by asker, professor, or admin.
7. Only admins may hide, lock, or unlock questions through moderation actions.

**Module 6 Acceptance Criteria**
1. Given a new question, when submitted, then it appears in searchable FAQ list.
2. Given student or professor answer submission, when posted, then answer appears under question without nested replies.
3. Given user vote, when toggled, then counters update consistently.
4. Given question marked resolved by asker, when state updates, then question status displays resolved.
5. Given query by keyword and tag, when search runs, then relevant items are returned.

**Module 7: Profiles and Contact**
1. Student and professor profiles include username, photo, and contact information.
2. Users can choose a username distinct from email-derived display name.
3. Users can control visibility of email-derived name and username.
4. Users can set preferred contact method on profile.
5. Professor and admin profiles show verification badge.
6. Professor profiles include the university-provided office-hours document, with office-hours information displayed using the configured campus timezone.
7. Office-hours documents support PDF, PNG, JPEG, DOC, DOCX, and Excel formats; the uploaded document is the authoritative office-hours record and is not parsed into structured recurring entries in MVP.
8. Students can discover professor profile from course context.

**Module 7 Business Rules**
1. Sensitive fields are role-restricted where required.
2. Profile visibility controls govern which identity and contact fields are visible by role.
3. Empty optional fields render with clear placeholders.
4. Verification badge is system-managed and not self-assignable.
5. Each professor has one current office-hours document; a new valid upload replaces the previous document and displays its last-updated timestamp.
6. `public` fields may be returned to authenticated directory viewers; `course_members_only` fields require active enrollment in a course group taught by the professor; `private` fields are returned only to the profile owner or an authorized admin action.
7. Contact-method and visibility mutations are owner-only; path identifiers must belong to the authenticated user.
8. Office-hours documents use private storage and short-lived signed URLs; authorization is rechecked at download time, and only the professor owner or an authorized admin may upload or delete a document for that professor.

**Module 7 Acceptance Criteria**
1. Given a user with custom visibility settings, when profile is viewed, then hidden identity fields remain hidden to unauthorized viewers.
2. Given a professor profile with an office-hours document, when viewed by a student, then the document is viewable or downloadable with the configured campus timezone and last-updated timestamp.
3. Given missing optional profile data, when profile opens, then UI remains complete and understandable.

**Module 8: Account Lifecycle and Deletion**
1. Users can request deletion of their own account with confirmation and fresh step-up verification.
2. Each user can have only one active deletion request; `users.deletion_requested_at` is set while the request is active and cleared on cancellation or completion.
3. A pending deletion request can be cancelled with fresh step-up verification; processing requests cannot be cancelled.
4. A single idempotent job processes deletion in fixed order, uses one transaction for database operations where possible, and a scheduled job retries failures without marking the request complete prematurely.
5. Legal holds block deletion completion until an authorized admin clears the hold.
6. Completion anonymizes the user while preserving required de-identified audit and historical authored records, removes private user-owned data, revokes sessions, releases teaching claims, and clears personal-event notification references.

**Module 8 Acceptance Criteria**
1. Given an active deletion request, when a second request is submitted, then it is rejected.
2. Given a pending deletion request, when the owner supplies fresh step-up verification and confirmation, then it is cancelled and remains historical.
3. Given a deletion job failure, when the scheduled retry runs, then processing resumes idempotently and the request is not marked completed until all required operations succeed.
4. Given an active legal hold, when deletion processing runs, then completion is blocked and the hold reason is retained.
5. Given completed deletion, when historical authored content and audit records are queried, then the user’s personal identifiers are not recoverable.

**Module 9: Admin Operations and System Controls**
1. Admins can review pending-role accounts, correct roles and account status, manage verification, revoke teaching claims, manage supported system configuration, and review security alerts and audit records.
2. Pending-review items include `proposed_role`; approved role decisions and role corrections require fresh step-up verification and are applied transactionally.
3. Admin role or account-status changes immediately invalidate affected active sessions; last-admin protection prevents lockout or demotion of the final active admin.
4. `active_term` uses the same semester format as course terms and is the canonical value for enrollment, teaching-claim, announcement, and edit-eligibility checks.
5. Audit logging covers deletions, document access, role and teaching-claim changes, imports, verification changes, security events, configuration changes, and disputed mutations; routine successful authorization checks are not logged.

**Module 9 Acceptance Criteria**
1. Given a pending-role account, when an admin approves a proposed role, then the decision, reviewer, proposed role, and timestamp are retained and the role update is atomic.
2. Given an admin account-status or role change, when the change completes, then affected active sessions are invalidated immediately.
3. Given an attempt to demote the final active admin, when the request is submitted, then the action is rejected.
4. Given an authorized admin configuration change, when it is saved, then the change is step-up protected and audit-logged.

**Explicit MVP Exclusions**
1. Automated account data export and portability endpoint are deferred beyond MVP.
2. Anonymous FAQ questions and answers are excluded; `author_id` is required for both resources.
3. Announcement muting is limited to courses; mute-by-professor is excluded.

**Cross-Cutting Non-Functional Requirements (MVP)**
1. Reliability: timetable and reminders should function without silent failure; import and notification failures must be observable.
2. Notification timeliness target: 95 percent of reminders dispatched within 60 seconds of scheduled window.
3. Import processing target: 95 percent of valid imports complete within 2 minutes.
4. Availability target: monthly uptime target is 99.5 percent for student-facing application.
5. Privacy: user data visibility follows role permissions and allowed-domain policy.
6. Privacy deletion SLA: account deletion requests are processed within 30 days.
7. Auditability: deletions, document access, role and teaching-claim changes, imports, and other disputed or security-relevant mutations are logged, with audit retention of 180 days; routine successful authorization checks are not logged.
8. Performance: timetable and notification feed initial load should be under 2.5 seconds on typical campus network.
9. Mobile usability: key timetable and reminder flows must work on mobile viewport.
10. Backup and restore targets: daily backups with RPO of 24 hours and RTO of 8 hours for MVP.
11. Accessibility baseline: WCAG 2.1 AA compliance for core flows (login, timetable, notifications, FAQ, and profile).
12. Supported browser matrix: latest two major versions of Chrome, Edge, Firefox, and Safari on desktop; Chrome on Android and Safari on iOS.

**Cross-Cutting Acceptance Criteria**
1. Given normal campus network conditions, when timetable or feed opens, then initial content is interactive within 2.5 seconds for at least 95 percent of requests.
2. Given scheduled reminders, when dispatch window is reached, then at least 95 percent are delivered within 60 seconds.
3. Given valid import files, when import runs, then at least 95 percent complete within 2 minutes.
4. Given month-end availability report, when computed, then uptime meets or exceeds 99.5 percent target.
5. Given account deletion request, when submitted, then request is completed within 30 days.
6. Given audit queries, when fetching admin actions, then logs remain available for at least 180 days.
7. Given a service disruption event, when recovery is performed, then restored data loss does not exceed 24 hours and service recovery does not exceed 8 hours.
8. Given accessibility audit of core flows, when evaluated, then WCAG 2.1 AA criteria are met for required checkpoints.
9. Given supported browser list, when core flows are tested, then functionality is confirmed on each listed browser and platform.

**Security Requirements (MVP)**
1. OAuth flow must enforce state and nonce validation to prevent token replay and request forgery.
2. Session tokens must be stored in secure transport mechanisms with HttpOnly, Secure, and SameSite protections.
3. Cookie-authenticated state-changing requests must include a server-issued CSRF token and pass configured `Origin` validation; SameSite is defense in depth.
4. Normal user session policy uses silent re-auth where possible, with 14-day idle timeout, 30-day absolute session lifetime, and explicit logout invalidation.
5. Interactive re-authentication is required on risk events, including new device sign-in, revoked account access, session integrity failure, or suspicious sign-in behavior that matches threshold rules.
6. Suspicious sign-in threshold rules for MVP are: country change within 12 hours since last successful sign-in, impossible-travel estimate above 800 km per hour between consecutive sign-ins, or first-time device fingerprint for that account.
7. Server-side authorization is mandatory for every protected action, independent of client-side checks.
8. Privileged admin actions (role changes, import apply, rollback) require step-up re-authentication valid for 10 minutes.
9. All traffic uses TLS in transit, and encryption at rest applies to all databases and backups.
10. File upload security for Excel imports and professor office-hours documents includes strict MIME and extension validation plus antivirus or malware scanning before storage or parsing.
11. Authentication abuse thresholds for MVP are: throttle sign-in for 15 minutes after 5 failed attempts from the same client IP or device fingerprint within 15 minutes, and require challenge verification plus security alert after 10 failed attempts on the same account within 60 minutes only for the affected client IP or device fingerprint.
12. Security-relevant events, disputed mutations, document access, role and teaching-claim changes, imports, and deletions are logged with tamper-evident integrity controls provided through restricted database grants and periodic external integrity exports or backups; routine successful authorization checks are not logged.
13. Secrets and credentials are never hardcoded in application source and are rotated via managed secret storage.
14. Incident response path is defined with alerting for repeated authentication abuse and failed import security scans.

**Security Acceptance Criteria**
1. Given OAuth callback handling, when state or nonce mismatches occur, then authentication is rejected and logged.
2. Given normal user sessions, when user remains active within 30-day absolute lifetime and without risk events, then re-authentication is silent when possible.
3. Given 14 days of inactivity or 30-day absolute session lifetime reached, when next request occurs, then interactive re-authentication is required.
4. Given sign-in from a different country within 12 hours of last successful sign-in, when login continues, then interactive re-authentication challenge is triggered.
5. Given consecutive sign-ins with estimated travel speed above 800 km per hour, when second sign-in occurs, then session upgrade requires additional verification.
6. Given five failed attempts from same client fingerprint in 15 minutes, when next login attempt occurs, then sign-in is throttled for 15 minutes.
7. Given ten failed attempts for same account in 60 minutes, when next attempt occurs, then challenge verification is required and security alert is emitted.
8. Given protected API endpoints, when authorization is missing or insufficient, then request is denied even if client UI attempted the action.
9. Given admin privileged action, when recent step-up re-auth older than 10 minutes is present or missing, then action is blocked pending re-authentication.
10. Given uploaded Excel file fails malware or file-type validation, when import starts, then parsing is blocked and security event is logged.
11. Given secret scanning of configuration, when hardcoded secret is detected, then deployment is blocked until remediation.

**Sign-Off Checklist (Module-by-Module)**
1. Foundational Data and Integrity Requirements: Approved
2. Module 1 Authentication and Identity: Approved
3. Module 2 Roles and Permissions: Approved
4. Module 3 Courses and Timetable: Approved
5. Module 4 Admin Schedule Import: Approved
6. Module 5 Notifications and Announcements: Approved
7. Module 6 FAQ: Approved
8. Module 7 Profiles and Contact: Approved
9. Cross-Cutting Non-Functional Requirements: Approved
10. Security Requirements (MVP): Approved

**Execution Order After Sign-Off**
1. Database design from approved requirements.
2. API design from approved requirements and database design.
3. Implementation planning and frontend flow design.


