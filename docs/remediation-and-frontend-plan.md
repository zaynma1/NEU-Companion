# NEU Companion — Remediation & Full Build Plan

**Purpose:** This is the single execution plan for (1) fixing everything `backend-audit-report.md`
found wrong or missing, (2) closing backend gaps the audit didn't explicitly call out but that
block a real launch, and (3) building the entire mobile frontend, screen by screen, with explicit
guardrails so Copilot/agent-generated UI doesn't drift into generic "AI app" territory.

This document is meant to **replace `docs/implementation-plan.md`** and sit alongside
`docs/milestones.md` / `docs/frontend-milestones.md` as the corrected source of truth. See
Section 0 for why.

Status legend matches the rest of the repo: `[ ]` not started · `[x]` done · `[~]` in progress.

---

## 0. Document cleanup — what's redundant or actively wrong

You asked for this first, so here it is before the plan itself. I verified each claim against
the repo rather than trusting file names.

| File | Verdict | Why |
|---|---|---|
| `docs/implementation-plan.md` | **Delete.** | Duplicates `docs/milestones.md` + `docs/frontend-milestones.md` domain-by-domain, but marks almost everything `[x]` complete (auth, courses, timetable, notifications, FAQ, profiles, admin ops, security hardening, rate limiting...) which the audit directly disproves — e.g. it claims "Implement admin verification / approval workflow" and "Add professor/course relationship checks" are done, but there is no `EnrollmentController`/`EnrollmentService` in the codebase at all (audit §3.1). Keeping two trackers where one is fiction is worse than keeping one. |
| `docs/milestones.md` | **Keep, but rewrite the status marks.** | Nearly every Milestone 3–5 checkbox is `[x]` "Complete," including things like "Core permissions and admin controls," "Notifications and announcements are implemented," and all of Milestone 5 (backup runbook, monitoring, rate limiting, deployment strategy — all `[x]`). The audit shows these are stubbed, buggy, or entirely unimplemented (§0, §5.1, §5.2, §7.1–7.4). This file is what `.github/prompts/start-task.prompt.md` tells every fresh Copilot session to trust first — right now it would tell Copilot "everything is done," which is actively harmful. See Section 5 for the corrected version. |
| `docs/frontend-milestones.md` | **Keep, correct Milestone 0.** | Milestone 0 ("Backend handoff gate") is marked fully complete, including "Auth/session hardening is implemented" and "API contract stability is verified." Given §1.1–1.4 (two auth bypasses, no CSRF, client-controlled device fingerprint) and §1.5 (half the admin routes 404 against their documented contract), this gate should not read as passed. Milestones 1–5 structure itself is good and I'm building directly on it in Section 3 — only the status marks need fixing. |
| `docs/test.md` | **Keep, rename.** | This isn't test notes — it's an independent database-design audit (missing tables, weak fingerprint storage, no unique constraint on notification idempotency keys, etc.). The name makes it look like scratch notes or a spec file, so it gets skipped. Rename to `docs/database-design-audit.md` and add it to the "source of truth" list in `.github/copilot-instructions.md` next to `backend-audit-report.md` — the two overlap on root causes (audit §11 already flags this) and should be read together. |
| `README.md` (root) | **Fix the "Repository structure" section.** | It points to `api-design/`, `database-design.md`, `requirments.md` (note the typo — that file doesn't exist; the real one is `docs/requirements.md`), and `test`. None of these paths are correct — everything actually lives under `docs/`. Low severity but it's the first file anyone (or any agent) opens. |
| `PLANVERIFICATION` (root, no extension) | **Delete once you've reviewed this plan.** | It's your own working checklist for this exact task (Supabase setup, "audit the backend," "write the plan," "strip redundant docs," "fix `.github`"). Its job is done once this document exists — leaving it in the repo root with no extension and no docs/ home is the kind of ad hoc file that becomes stale clutter in a month. |
| `docs/backup-restore-runbook.md`, `docs/monitoring-and-alerting-runbook.md` | **Keep as-is, but stop marking them "done."** | Both are genuinely well-written and worth keeping. The problem isn't the content, it's `docs/milestones.md` Milestone 5 marking "Backup/restore runbook" and "Monitoring and alerting" as `[x]` Complete when no backup automation or monitoring is actually wired into the running application — these are design documents for infrastructure that doesn't exist yet. Leave the docs, fix the status (Section 5). |
| `apps/mobile/AGENTS.md` / `apps/mobile/CLAUDE.md` | **Keep, low priority.** | These are Claude-Code-specific (Expo version pinning reminder), not Copilot-specific, and don't conflict with anything in `.github/`. Not redundant, just narrow — no action needed unless you also want Claude Code sessions to see the same design-system rules, in which case add one line pointing to `.github/copilot-instructions.md`. |

Net effect: **one deletion (`implementation-plan.md`), one removal once reviewed (`PLANVERIFICATION`), one rename (`test.md`), two status rewrites (`milestones.md`, `frontend-milestones.md`), one small fix (`README.md`).** No `docs/api-design/domain-XX-*.md` file is redundant — they're the actual contracts and the plan below treats them as such.

---

## 1. Backend remediation plan

Organized so nothing gets fixed out of order relative to what it depends on. Each item cites the
audit section it comes from. Items with **(new)** were not in the audit — I found them by
cross-checking `docs/database-design.md` against the entity files and `PLANVERIFICATION`'s own
open checklist.

### Phase B0 — Data layer (blocks literally everything else)
- [x] Generate and commit migrations for all entities currently missing one: `courses`,
  `course_groups`, `enrollments`, `professor_teaching_claims`, `official_events`,
  `personal_events`, `notifications`, `announcements`, `muted_courses`,
  `notification_preferences`, `notification_delivery_logs`, all FAQ tables (`category_tags`,
  `questions`, `question_tags`, `answers`, `question_votes`, `answer_votes`, `reports`), all
  profile tables (`profiles`, `contact_methods`, `visibility_settings`,
  `professor_schedule_documents`), all admin-import tables (`import_batches`,
  `import_row_errors`, `dataset_versions`). *(audit §0.1)*
- [x] **(new)** Add the `personal_event_exceptions` entity + migration. It's documented in
  `docs/database-design.md` §3 and required for scope-aware recurring-event edits (see B4 below,
  audit §4.2), but no entity file exists for it anywhere in `apps/api/src/timetable/entities`.
- [x] Run `npm run migration:run` against a real local Postgres and confirm every table in
  `docs/database-design.md` exists before touching anything else.
- [x] Add a `migration:run` step to `.github/workflows/ci.yml` against the CI Postgres service so
  this can't silently regress again.

### Phase B1 — Security-critical (exploitable today, not just spec drift)
- [x] Remove the "trust the caller" fallback in `validateGoogleCallbackInput`
  (`auth.service.ts` ~line 616) — never accept client-supplied `email`/`googleSub` without a
  verified `code` or `idToken` once a real Google client is configured. *(audit §1.1)*
- [x] Remove or dev-gate `POST /auth/signin` (`auth.controller.ts` line 293) — strip it from the
  production build or require an explicit dev-only flag. *(audit §1.2)*
- [x] Implement CSRF protection (double-submit or synchronizer token) for all non-GET routes, and
  replace `app.enableCors({ origin: true, credentials: true })` in `main.ts` with an explicit
  origin allow-list plus `Origin`/`Referer` validation. *(audit §1.3)*
- [ ] Move device fingerprinting server-side: issue a signed, HttpOnly device cookie on first
  contact instead of trusting the `deviceFingerprint` field in the request body
  (`auth.controller.ts`, `auth.service.ts createSession`). *(audit §1.4)*
- [ ] Fix office-hours upload/delete authorization: `upsertProfessorOfficeHours` and
  `deleteProfessorOfficeHours` in `profile.controller.ts`/`profile.service.ts` must check
  `req.user.id === professorId || req.user.role === 'admin'` — right now any logged-in student
  can overwrite or delete any professor's document. *(audit §8.1)*

### Phase B2 — Routing/contract consistency (cheap, mechanical, unblocks frontend work)
- [ ] Standardize on `app.setGlobalPrefix('api/v1')` in `main.ts`; remove the ad hoc per-controller
  prefixes on `admin-users.controller.ts`, `admin-role.controller.ts`,
  `pending-review.controller.ts`, and the auth controller's dual `['auth', 'api/v1/auth']`
  registration so every route matches its documented contract in `docs/api-design/domain-XX-*.md`.
  *(audit §1.5, also affects §9 account-deletion routes)*
- [ ] Change the office-hours upsert route from `POST` to `PUT` to match `domain-07`. *(audit §8.4)*

### Phase B3 — The actual product pipeline (currently has no working path end to end)
- [ ] Build `EnrollmentController`/`EnrollmentService` and every documented Domain 2 endpoint:
  `GET /courses`, `GET /courses/{id}`, `GET /courses/{id}/groups`, `GET /enrollments`,
  `POST /enrollments`, `POST /enrollments/{id}/drop`, `POST /enrollments/switch`,
  `GET /courses/{id}/groups/{id}/eligibility`, `GET /students/me/courses`. *(audit §3.1)*
- [ ] Add auth guard + caller-scoped filtering to `GET /professor/teaching-claims`
  (`professor-teaching-claim.controller.ts`) — it's currently unauthenticated and leaks every
  professor's data. *(audit §3.2)*
- [ ] Add `POST /professor/teaching-claims` (self-claim), `DELETE /professor/teaching-claims/{id}`
  (release), and `POST /admin/teaching-claims` (admin assign/revoke). *(audit §3.3, §10)*
- [ ] Write the actual Excel/CSV parser for `AdminImportService.validateImportFile` — replace the
  stub with real parsing, template-version check, and field-level validation (course code/group/
  date/time/location, duplicate-row detection). *(audit §7.1)*
- [ ] Make `applyImport` actually create `OfficialEvent` rows from parsed data — right now a
  "successful" import produces zero events. *(audit §7.2)*
- [ ] Fix `rollbackImport` so only one `DatasetVersion` per term is ever `isCurrent: true` — either
  just flip `targetVersion.isCurrent` and log the rollback in the audit log, or carry over the
  target version's `OfficialEvent` associations onto a new row. *(audit §7.3)*
- [ ] Implement real `getImportDiff` (add/update/remove counts) instead of the hardcoded
  `{ addCount: 0, updateCount: 0, removeCount: 0 }` stub. *(audit §7.4)*
- [ ] Add `ensureFreshStepUp` checks to `applyImport`/`rollbackImport` (both need a `sessionId`
  param added). *(audit §7.5)*
- [ ] Add MIME-type/extension whitelist, filename whitelist, row-count limit to the import upload
  interceptor. *(audit §7.6 — see also B5 for AV scanning)*
- [ ] Change the duplicate-content-hash check from a hard rejection at upload time to a graceful
  no-op at apply time (return the existing current version instead of erroring). *(audit §7.7)*
- [ ] Build the reminder-generation pipeline: a scheduler (NestJS `@nestjs/schedule`, or a queue
  worker on the Redis instance that's already provisioned but currently unused — see B5) that
  turns upcoming `OfficialEvent`/`PersonalEvent` rows into `Notification` rows at the 1-day/
  3-hour/1-hour/due-time windows, calling the existing (but never-invoked)
  `NotificationService.generateIdempotencyKey()`. This is the single biggest gap relative to the
  product's stated goal ("reduce missed events") and depends on B0 + the import pipeline above
  actually producing real `OfficialEvent` rows. *(audit §5.1)*

### Phase B4 — Domain bug fixes (implemented but wrong)
**Auth & Identity**
- [ ] Wire `RoleAssignmentService.inferRoleForEmail`/`applyRoleFromEmail` into
  `findOrCreateUser` — currently every new user hard-codes to `role: 'pending'`. *(audit §2.2)*
- [ ] Insert a `PendingReviewItem` when a user first authenticates as pending — currently
  `pendingReviewRepository.create()` is never called, so the admin review queue is always empty.
  *(audit §2.3)*
- [ ] Build the onboarding flow: `GET/POST /auth/onboarding`, reading/writing
  `users.onboardingCompletedAt`, prompting for full name / student-staff ID / department.
  *(audit §2.1)*
- [ ] Add `POST /auth/switch-account`. *(audit §2 table)*
- [ ] Distinguish callback failure outcomes in the audit trail (disallowed domain vs. blocked
  account vs. actual state/nonce mismatch) instead of always recording
  `outcome: 'state_nonce_mismatch'`. *(audit §2.4)*
- [ ] Move `assertClientRateLimit` earlier so failing traffic is throttled before identity
  verification completes, not after. *(audit §2.5)*
- [ ] Add rate limiting to `createChallenge`. *(audit §2.6)*
- [ ] Enforce `idleExpiresAt` in `validateSessionToken` and bump `lastActiveAt`/`idleExpiresAt` on
  each successful validation (sliding 14-day window); align the session cookie `maxAge` with the
  30-day absolute lifetime instead of the current 7-day mismatch. *(audit §1.6)*
- [ ] Switch `hashToken` from plain SHA-256 to an HMAC with a server-side secret key. *(audit §1.7)*

**Timetable**
- [ ] Replace hardcoded `severity: 'hard'` in `checkConflicts` with real overlap-percentage /
  event-type-based soft/hard logic. *(audit §4.1)*
- [ ] Implement `scope` handling (`this_occurrence` / `this_and_future` / `entire_series`) in
  `updatePersonalEvent`/`deletePersonalEvent` using the new `personal_event_exceptions` table
  from B0. *(audit §4.2)*
- [ ] Fix the timetable range query to use overlap logic (`start < end AND end > start`) instead
  of strict containment — same pattern already used correctly in `checkConflicts`. *(audit §4.3)*
- [ ] Let professors (active teaching claim) and admins past the enrollment-only check in
  `getOfficialEventDetail`/`getOfficialEventsForCourseGroup`. *(audit §4.4)*
- [ ] Normalize `null` location to `"TBA"` at the API/DTO layer. *(audit §4.5)*

**Notifications & Announcements**
- [ ] Replace the three hardcoded stubs in `AdminNotificationController`
  (`getDeliveryStatus`, `listFailedNotifications`, `retryNotification`) with real queries against
  `Notification`/`NotificationDeliveryLog`. *(audit §5.2)*
- [ ] Fix the inverted `verifiedAt: MoreThan(new Date())` check in `publishAnnouncement` — should
  check `verifiedAt IS NOT NULL AND releasedAt IS NULL`. *(audit §5.3)*
- [ ] Add a daily announcement cap per course. *(audit §5.4)*
- [ ] Make dispatch logic (once B3's reminder pipeline exists) actually check
  `remindersEnabled`/`announcementsEnabled`/`MutedCourse` before creating a notification.
  *(audit §5.5)*
- [ ] Add an eligibility check (enrolled / professor / admin) to `getAnnouncementDetail` and the
  list endpoint — currently any authenticated user can read any announcement. *(audit §5.6)*
- [ ] Add a secondary `id` ordering tiebreaker to the notification feed cursor, matching
  `markAllAsRead`'s existing pattern. *(audit §5.7)*

**FAQ & Moderation**
- [ ] Build the missing admin moderation surface: `POST /admin/faq/questions/{id}/lock`,
  `/unlock`, `GET /admin/faq/reports`, `POST /admin/faq/reports/{id}/resolve`. *(audit §6.1)*
- [ ] Fix `reopenQuestion` to compare an `actorRole` parameter instead of comparing `userId`
  against the literal strings `'professor'`/`'admin'` (requires a signature change to pass the
  caller's role through). *(audit §6.2)*
- [ ] Make votes updatable in place (`createQuestionVote`/`createAnswerVote`) instead of rejecting
  a second vote outright. *(audit §6.3)*
- [ ] Implement real popularity sorting — currently both branches of the sort ternary order by
  `createdAt`. *(audit §6.4)*
- [ ] Make the 7-day edit window configurable via `system_config` instead of hardcoded.
  *(audit §6.5)*

**Profiles**
- [ ] Implement private storage + short-lived signed URLs for office-hours documents, with
  re-authorization at download time. *(audit §8.2)*
- [ ] Add `POST /profile/photo` as a real multipart upload endpoint. *(audit §8.3)*

**Account Lifecycle**
- [ ] Give completed deletions a distinct terminal `accountStatus` instead of reusing
  `'deletion_pending'` for both the requested and completed states. *(audit §9)*
- [ ] Require fresh step-up verification (`ensureFreshStepUp`) before `cancelDeletionRequest`
  proceeds. *(audit §9)*

**Admin Operations**
- [ ] Revoke active sessions on `setUserRole`, matching the existing behavior in
  `setAccountStatus`. *(audit §10)*

### Phase B5 — Infrastructure gaps not in the audit but needed before launch
- [ ] **(new)** Wire up the reminder/notification dispatch worker on the Redis instance —
  `docs/TECH_STACK.md` lists Redis as "reserved for future session optimization," but it's
  currently unused for anything. A queue (BullMQ) on top of it is the natural home for B3's
  reminder pipeline and rate limiting.
- [ ] **(new)** Add malware/antivirus scanning to the import upload path (`domain-04` and
  Security Requirement #10 both call for it; audit §7.6 flags the whitelist gap but the scanning
  requirement itself is a separate, larger piece of infra — likely ClamAV as a sidecar or a
  third-party scanning API).
- [ ] **(new)** Add a session rotation strategy — flagged `[ ]` not done in the old
  `implementation-plan.md` itself and never revisited since.
- [ ] **(new)** Add observability/metrics and error tracking (also flagged `[ ]` in the old plan) —
  needed before `docs/monitoring-and-alerting-runbook.md` can honestly be marked anything but a
  design doc.
- [ ] **(new)** Finish the `PLANVERIFICATION` database/environment checklist that's still open:
  configure the production Supabase project, run and verify migrations against it, and verify the
  Google OAuth flow against each environment separately (dev already done per that checklist).
- [ ] **(new)** Add E2E tests for the key user journeys and mobile UI regression checks — both
  flagged `[ ]` in the old plan, and both become achievable only after B3's product pipeline
  actually has something end-to-end to test.

---

## 2. Frontend build plan — full screen inventory

This extends `docs/frontend-milestones.md` Milestones 2–5 (keep using that file to track
progress) with the concrete list of screens each milestone actually produces, mapped to the 9 API
domains per `.github/copilot-instructions.md`'s working convention #1. Screens tagged **(blocked)**
can't be meaningfully built until their Phase B item above lands — build the shell/empty state
first if you want to unblock navigation work, but the real screen waits on the API.

**Auth & onboarding (Domain 1 / Milestone 2)**
- Sign-in screen — Google OAuth entry point (blocked on the "secure cookie handling" item already
  called out in `frontend-milestones.md` Milestone 2)
- Session restore / splash (exists)
- Pending / first-run gate (exists, needs onboarding wired once backend §2.1 lands) **(blocked)**
- Onboarding form (name / student-staff ID / department) **(blocked on B4 §2.1)**
- Account & sessions screen — active session list, revoke, logout-all
- Step-up re-auth prompt — shared component, triggered before any sensitive action app-wide
- Account deletion request / cancel / status screen

**Courses & enrollment (Domain 2 / Milestone 3) — (blocked on B3, no API exists yet)**
- Course catalog / browse (student)
- Course detail — groups list, eligibility
- Enrollment confirmation sheet, drop/switch flow
- My enrollments screen
- My teaching claims screen (professor) — claim/release
- Teaching-claim assignment/revocation screen (admin)

**Timetable & personal scheduling (Domain 3 / Milestone 3)**
- Weekly timetable view — merges official + personal events
- Event detail (official and personal)
- Add/edit personal event — recurrence controls, scope-aware edit/delete
  **(scope semantics blocked on B4 §4.2)**
- Conflict warning UI — soft vs. hard **(blocked on B4 §4.1)**

**Notifications & announcements (Domain 5 / Milestone 3)**
- Notification feed
- Notification preferences (reminders/announcements toggles, per channel)
- Muted courses management
- Announcement compose (professor) **(blocked on B3/B4 §5.3, §3.3)**
- Announcement detail
- Admin: delivery status / failed notifications / retry **(blocked on B4 §5.2)**

**FAQ & moderation (Domain 6 / Milestone 3)**
- FAQ browse/search (recency + popularity sort — popularity blocked on B4 §6.4)
- Question detail — answers, voting, accept-answer
- Ask question
- Report content flow
- Admin: moderation queue — lock/unlock, resolve reports **(blocked on B4 §6.1)**

**Profiles, contact & office hours (Domain 7 / Milestone 3)**
- My profile view/edit
- Public profile view (visibility-rule aware)
- Contact methods management
- Office hours — student view; professor edit/upload **(upload blocked on B4 §8.2/§8.3)**

**Admin operations (Domain 9 / Milestone 4)**
- Admin dashboard shell
- User search & role management
- Account status management (suspend/block)
- Allowed email domains config
- Role assignment rules config
- Audit log viewer with filtering
- Security alerts review
- System config screen
- Import monitoring — upload, validation/diff review, dataset version history & rollback
  (Domain 4, blocked on B3 import pipeline items)

**Cross-cutting (Milestone 5)**
- Settings — theme override, notification preferences entry point
- Shared empty/error/offline state components (see Section 3, Rule 6)
- Reduced-motion and accessibility pass across all of the above

---

## 3. Anti-"AI-look" guardrails for the frontend

**What's already in place — don't re-add this, extend it instead:**
`.github/copilot-instructions.md` already defines the full token system (colors, typography,
spacing, motion) and the two non-negotiable rules that matter most for "looking AI-generated":
the transform/opacity-only animation rule, and the shared motion-token requirement.
`.github/instructions/mobile-design.instructions.md` (scoped to `apps/mobile/**`) goes further
and encodes three specific anti-patterns caught by auditing the two screens that already exist:
no decorative overline/eyebrow labels above headings, one signature motion moment per flow (not
motion-per-element), and varied container treatment instead of every block being the same
bordered card. These are good and should keep being the first thing any new screen is checked
against.

**The gap:** those three rules were derived from two auth screens. Milestones 3–4 above introduce
screen types — dashboards, dense lists, forms, empty states — that weren't part of that audit and
have their own generic-AI-app tells. Add the following as a new section in
`.github/instructions/mobile-design.instructions.md` (or a new path-scoped file if you'd rather
keep it separate) before Milestone 3 work starts:

```markdown
## 4. Dashboards and stat summaries — don't grid-ify every metric identically

The generic-admin-template tell is a row of identical cards, each with an icon in a tinted
rounded square, a big number, and a label underneath — repeated for every metric regardless of
whether that metric is the most important thing on the screen or a footnote. Before building the
admin dashboard or any summary screen: pick the one or two numbers that actually matter for that
screen and give them real visual weight (larger type, more space); render secondary figures
inline or in a compact list instead of promoting them to their own identical card. Not every
number on a dashboard deserves the same box.

## 5. List rows — icons must carry information, not decoration

Don't prefix every row in a list with a leading icon or a trailing chevron by default. A chevron
implies "tapping this goes somewhere deeper" — only add one where that's literally true. A
leading icon/avatar should identify *which* item this is (a course color swatch, a person's
avatar, an announcement's course badge), not just mark "this is a list item." If every row in a
list has the same generic icon, remove it — it's not doing anything a well-designed row layout
and typography hierarchy can't already do.

## 6. Empty states — specific to the screen, not a reusable template

No centered illustration + "Nothing here yet" boilerplate copy-pasted across every empty list
(courses, notifications, FAQ, audit log). Each empty state should say what's actually missing and
what the person can do about it in this specific context — "You're not enrolled in any courses
yet" with a link to browse, vs. "No announcements from your courses" with no action needed, are
different states and should read differently. Skip the illustration unless it's carrying real
information; a well-set heading and one line of body text is usually enough per Part 1's spacing
and typography system.

## 7. Forms — group with spacing, not a bordered card per field

Related fields (e.g. name + student ID + department in onboarding) sit in one visually grouped
section using spacing and an optional section label, not each wrapped in its own bordered
`surface` card. Validation errors render inline under the specific field in `danger` text, not
collected into a boxed banner listing every error at the top of the form.

## 8. Loading states — skeletons mirror the real content shape

A skeleton for a course list row looks like a course list row (title-width bar, subtitle-width
bar, a swatch-sized block) — not a generic stack of same-width gray rectangles reused for every
loading screen in the app. Build the skeleton from the same layout component as the real row
where practical, swapping content for shimmer blocks, so loading and loaded states don't visually
jump.
```

This keeps the same voice and "what happened → the rule" structure as the existing file, and
gives Copilot concrete review gates for the screen types Milestones 3–4 actually introduce,
instead of leaving it to re-derive them from scratch the way the first two screens did.

---

## 4. Corrected doc excerpts

Two files need their status sections rewritten, not just checkboxes flipped — a wall of `[x]`
next to things that are stubs is worse than an honest `[ ]`, because it's what Copilot reads as
ground truth before touching anything. Suggested replacements:

**`docs/milestones.md` — Milestone 3, 4, 5** should read `Status: In progress` (not the current
mix that implies near-completion) with the specific unfinished items above unchecked, and a
pointer at the top of the file: *"See `docs/remediation-and-frontend-plan.md` for the current gap
list and execution order — this file tracks the domain checklist, that file tracks what's actually
broken and in what order to fix it."*

**`docs/frontend-milestones.md` — Milestone 0** should uncheck "Auth/session hardening is
implemented" and "API contract stability is verified" until Phase B1/B2 above are done — the
frontend can still start on non-auth-dependent scaffolding, but the handoff gate as originally
defined hasn't actually passed.

**`.github/copilot-instructions.md`** currently opens with *"Backend (`apps/api`) is built."*
Once you start Phase B work, change this to something like: *"Backend (`apps/api`) has a working
skeleton across all 9 domains but is mid-remediation — check
`docs/remediation-and-frontend-plan.md` before assuming any endpoint matches its documented
contract or is fully implemented."* Otherwise every fresh Copilot session will keep treating
stubbed endpoints as done.

---

## 5. Suggested execution order

1. Phase B0 (migrations) — nothing else can be verified against a real database without this.
2. Phase B1 (auth bypasses, CSRF, fingerprint, office-hours auth hole) — exploitable today.
3. Doc cleanup from Section 0 — five-minute job, do it once B0/B1 are merged so the corrected
   milestone docs reflect the real state rather than needing a second pass.
4. Phase B2 (route prefixes) — cheap, unblocks the frontend team from hardcoding wrong paths.
5. Phase B3 (enrollment API, import pipeline, reminder dispatch) — this is the actual product;
   frontend Milestone 3 screens for Domains 2, 4, and 5 are blocked until this lands.
6. Frontend Milestone 2 (auth/onboarding screens) can proceed in parallel with B3 once B1/B2 are
   done — it only depends on Domain 1, which just needs its Phase B4 bug fixes.
7. Phase B4 sweep (remaining domain bugs) alongside frontend Milestone 3, fixing each domain
   just ahead of the screens that depend on it.
8. Phase B5 (infra: queue, AV scanning, observability, production Supabase, E2E tests) before
   frontend Milestone 5 (release readiness) — no point polishing device QA on top of an
   unmonitored, unscanned production backend.
9. Frontend Milestone 4 (admin screens) once Phase B4's admin-facing fixes (FAQ moderation,
   notification admin stubs, teaching-claim assignment) land.
10. Frontend Milestone 5 (device QA, guardrail self-check per Section 3, release checklist) last.






























