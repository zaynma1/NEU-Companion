# NEU-Companion Backend Audit Report

**Scope:** `apps/api` (NestJS/TypeORM) compared against `docs/requirements.md` and the nine `docs/api-design/domain-0X-*.md` contract documents.
**Method:** Static review of controllers, services, entities, DTOs, and the single migration file, cross-referenced line-by-line against the documented endpoints and business rules. `apps/mobile` was spot-checked for context only.
**Not covered:** Live runtime testing (no DB was provisioned), load/performance testing, and full test-suite audit (the `*.spec.ts` files exist but were not run).

## How to read this report

Each finding lists: **Domain**, **Severity**, the relevant requirement/spec citation, the code location, and the concrete problem. Severity is:
- 🔴 **Critical** — breaks core functionality, a security hole, or blocks the app from running at all in a real deployment.
- 🟠 **High** — a documented requirement/endpoint is missing or the implementation silently does the wrong thing.
- 🟡 **Medium** — a real bug or gap, but narrower blast radius or has a workaround.
- ⚪ **Low / Note** — style, consistency, or forward-looking observation.

---

## 0. Top-level summary

The project has a reasonably well-built **Authentication domain** (Google OAuth verification, sessions, challenges, audit log, admin user management) but almost everything downstream of it is either **stubbed, partially wired, or missing a database migration**. Three findings are severe enough to affect the whole system and are listed first because every other domain finding should be read in light of them:

1. **Only 11 of ~34 entity tables have a migration.** `courses`, `course_groups`, `enrollments`, `professor_teaching_claims`, `official_events`, `personal_events`, `notifications`, `announcements`, `muted_courses`, `notification_preferences`, `notification_delivery_logs`, all FAQ tables, all profile tables, and all admin-import tables have **no migration at all**. With `synchronize: false` and `migrationsRun: false` set everywhere (`apps/api/src/config/database.config.ts`), a fresh deployment following the documented `npm run migration:run` workflow will be missing these tables entirely — every endpoint outside the auth domain will 500 on a real database.
2. **The Excel import pipeline never parses the file.** `AdminImportService.validateImportFile` is a hard-coded stub (`// Stub validation ... For now, accept any file with header row`, always returns 1 row, zero errors), and `applyImport` never inserts a single `OfficialEvent` row. Publishing an import only flips a `DatasetVersion.isCurrent` flag — the actual timetable data pipeline (Product Goal #1) does not exist.
3. **There is no reminder/notification dispatch worker anywhere in the codebase.** No cron/scheduler/queue exists. `NotificationService.generateIdempotencyKey()` is defined but never called by anything. The core "reduce missed academic events through reminders" goal (Product Goal #2) has no implementation path from "official event exists" to "notification is created."

Given these three, most other domain gaps below (missing enrollment API, empty announcement pipeline, etc.) are symptoms of the same underlying issue: the project has authentication and CRUD scaffolding for several domains, but the actual cross-domain business logic that requirements.md describes as the product ("see lectures/exams/deadlines in one place," "reduce missed events") was not completed.

---

## 1. Critical / cross-cutting issues

### 1.1 🔴 Authentication bypass via `/auth/google/callback` with no OAuth code or ID token
**File:** `apps/api/src/auth/auth.service.ts`, `validateGoogleCallbackInput` (~line 616); `auth.controller.ts` `googleCallback` (~line 130).

When `GOOGLE_CLIENT_ID`/`SECRET` **are** configured (i.e. a real production-like environment) but the caller sends `{ email, googleSub }` directly in the POST body with **no `code`**, the controller's branch selection falls through to `validateGoogleCallbackInput`. Inside that function:
```ts
const needsStateValidation = !!clientId && !!input.code;
```
Since `input.code` is absent, `needsStateValidation` is `false`, so **state/nonce is never checked**, and the function accepts the client-supplied `email`/`googleSub` as-is (only checking the email's domain suffix). This lets anyone create a session for **any email address in an allowed domain**, with no proof of Google identity at all. This is a full authentication bypass / account takeover vector.

**Fix:** `validateGoogleCallbackInput`'s "trust the caller" fallback path should never exist once a real Google client is configured. Either remove it entirely in favor of always requiring a verified `idToken` or a `code`, or gate it strictly behind a `NODE_ENV !== 'production'` + no-Google-client check.

### 1.2 🔴 Undocumented `/auth/signin` endpoint bypasses Google entirely
**File:** `apps/api/src/auth/auth.controller.ts` line 293 (`@Post('signin')`).

Accepts `{ email, firstName, lastName, googleSub }` from the client, only checks the domain suffix (`ensureAllowedDomain`), and creates a session — no Google verification of any kind, no environment gating. This endpoint doesn't appear in `domain-01-authentication-identity.md` at all. Combined with 1.1, there are effectively **two** unauthenticated ways to obtain a valid session cookie for any user in an allowed domain.

**Fix:** Remove from the production build, or restrict behind an explicit dev-only flag and strip from `main.ts` route registration in production.

### 1.3 🔴 No CSRF protection anywhere, plus permissive CORS
**Files:** searched entire `apps/api/src` — no CSRF token issuance/validation, no `Origin` header check exists. `apps/api/src/main.ts`:
```ts
app.enableCors({ origin: true, credentials: true });
```
This reflects **any** request origin while allowing credentialed (cookie) requests. `domain-01` explicitly requires: *"every cookie-authenticated state-changing endpoint requires a server-issued CSRF token and validates the request Origin against configured application origins."* Security Requirement #3 states the same. Neither is implemented. `SameSite=Lax` (in `runtime.config.ts`) provides some mitigation for classic fetch/XHR CSRF, but the spec explicitly calls SameSite "defense in depth, not the sole CSRF control" — here it is the *only* control, and CORS is wide open on top of it.

**Fix:** Implement a CSRF double-submit or synchronizer-token pattern for all non-GET routes, validate `Origin`/`Referer` against an explicit allow-list, and change CORS `origin` to that same allow-list instead of `true`.

### 1.4 🔴 Client fully controls the "server-controlled" device fingerprint
**Files:** `auth.controller.ts` (`deviceFingerprint` read straight from request body/DTO in `googleCallback`, `createChallenge`, `verifyChallenge`), `auth.service.ts` `createSession`.

Requirement #20 (Foundational) and the API design explicitly state device binding must be **server-controlled, non-PII**, and that "clients cannot choose their authoritative fingerprint." In the current implementation the fingerprint is just whatever string the client sends in the JSON body, with a default of `'unknown-device'`/`'google-oauth-device'` if omitted. This defeats the purpose of device-based risk throttling and new-device challenge triggers entirely — an attacker can simply send a fresh fingerprint every request to dodge throttling, or replay a victim's fingerprint to avoid a device challenge.

**Fix:** Derive the fingerprint server-side from a signed, HttpOnly device cookie set on first contact (as the spec describes) instead of trusting a body field.

### 1.5 🟠 Admin routes are inconsistently mounted — half are missing the documented `/api/v1` prefix
**Files:** `apps/api/src/auth/admin-users.controller.ts`, `admin-role.controller.ts`, `pending-review.controller.ts` all declare `@Controller('admin')`. Meanwhile `admin-import.controller.ts` and the notifications admin controller declare `@Controller('api/v1/admin')`.

Every domain doc (04, 05, 08, 09) documents admin paths as `/api/v1/admin/...`. In reality:
- `GET /api/v1/admin/pending-review` → **404**; the real route is `GET /admin/pending-review`.
- `GET /api/v1/admin/users`, `/api/v1/admin/users/:id/role`, `/api/v1/admin/deletion-requests`, `/api/v1/admin/allowed-email-domains`, `/api/v1/admin/audit-logs`, `/api/v1/admin/security-alerts`, `/api/v1/admin/system-config` → all **404**; real routes drop the `/api/v1` prefix.
- Only `/api/v1/admin/imports/*` and `/api/v1/admin/notifications/*` match the documented contract.

Similarly, `apps/api/src/auth/auth.controller.ts` is `@Controller(['auth', 'api/v1/auth'])`, so account-deletion routes resolve to `/api/v1/auth/account/deletion`, not the documented `/api/v1/account/deletion` (`domain-08-account-lifecycle-deletion.md`).

**Fix:** Standardize on a single global prefix (`app.setGlobalPrefix('api/v1')` in `main.ts`) and remove the ad-hoc per-controller prefixes so every route matches its domain doc.

### 1.6 🟠 Session idle timeout is defined but never enforced or refreshed
**File:** `auth.service.ts` `createSession` (sets `idleExpiresAt`/`lastActiveAt` once, at creation) and `validateSessionToken`:
```ts
async validateSessionToken(token: string): Promise<Session> {
  const session = await this.findSessionByToken(token);
  if (!session) throw ...;
  if (new Date(session.absoluteExpiresAt) < new Date()) throw ...;
  return session;
}
```
`idleExpiresAt` is never checked here, and `lastActiveAt`/`idleExpiresAt` are never updated on subsequent requests (confirmed via repo-wide grep — the only writes are in `createSession`). Security Requirement #4 requires a **14-day idle timeout** in addition to the 30-day absolute lifetime; as implemented, a session is valid for the full 30 days regardless of activity, and the idle-timeout acceptance criteria (Security AC #3) cannot pass.

Additionally, the session cookie's `maxAge` is hard-coded to 7 days (`runtime.config.ts`), so the browser will drop the cookie after a week even though the server-side session would otherwise remain valid for up to 30 — an inconsistency between client and server session lifetimes.

**Fix:** Check `idleExpiresAt` in `validateSessionToken`, bump `lastActiveAt`/`idleExpiresAt` on each successful validation (sliding window), and align cookie `maxAge` with the absolute session lifetime.

### 1.7 ⚪ Token hash uses plain SHA-256, not the specified HMAC strategy
**File:** `auth.service.ts` `hashToken` (`createHash('sha256').update(token).digest('hex')`).
Spec: *"token hashes must use a secure HMAC strategy."* A plain hash of a high-entropy random UUID is not itself insecure, but it doesn't meet the literal requirement (no server-side secret key involved), and if token generation were ever weakened this becomes a real gap.

---

## 2. Domain 1 — Authentication & Identity

| Documented endpoint | Status |
|---|---|
| `POST /auth/google/start` | ✅ implemented |
| `POST /auth/google/callback` | ⚠️ implemented, but see 1.1 |
| `GET /auth/session` | ✅ implemented |
| `POST /auth/logout` | ✅ implemented |
| `POST /auth/logout-all` | ✅ implemented |
| `GET /auth/sessions` | ✅ implemented |
| `POST /auth/sessions/{id}/revoke` | ✅ implemented |
| `POST /auth/challenge` | ✅ implemented |
| `POST /auth/challenge/verify` | ✅ implemented |
| `POST /auth/switch-account` | 🟠 **missing** |
| `GET /auth/onboarding` | 🟠 **missing** |
| `POST /auth/onboarding` | 🟠 **missing** |

### 2.1 🟠 Onboarding flow is entirely unimplemented
`users.onboardingCompletedAt` exists as a column but nothing ever reads or writes it, and neither documented onboarding endpoint exists. Module 1 requirement #10 ("prompts for the missing required first-login fields: full name, student/staff ID, department") has no code path. New users whose Google claims are unusable (or whose email local part doesn't match the expected ID format) have no way to complete their profile through the documented flow.

### 2.2 🟠 Role inference is dead code — every new user lands in `pending`
`RoleAssignmentService.inferRoleForEmail`/`applyRoleFromEmail` (`apps/api/src/auth/role-assignment.service.ts`) are registered as providers in `auth.module.ts` but **never called** from `AuthController` or `AuthService`. `findOrCreateUser` hard-codes `role: 'pending'` for every new user regardless of `role_assignment_rules`. Module 1 requirement #5 ("System assigns role using configured rules") is not functioning — the system only ever exercises the pending/manual-review fallback path.

### 2.3 🟠 Pending-review queue is never populated
Repo-wide search shows `pendingReviewRepository.create(...)` is **never called** — only `.save()` on items fetched by ID (in `setUserRole`'s auto-supersede logic and `decidePendingReviewItem`). `GET /admin/pending-review` will always return an empty list in practice; there is no code path that inserts a `PendingReviewItem` when a user first authenticates as pending. Foundational Requirement #9 ("Pending-role accounts enter an admin review queue…") and Module 9 Acceptance Criterion #1 are unmet. (Admins can still fix a user's role directly via `POST /admin/users/:id/role`, which works, but that bypasses the documented review-queue workflow entirely.)

### 2.4 🟡 All callback failures are mislabeled with one generic outcome
`auth.controller.ts` catches every error thrown during identity verification (domain rejected, account blocked, state/nonce mismatch) in a single `catch` block and always records `outcome: 'state_nonce_mismatch'`:
```ts
await this.authService.recordAuthAttempt({ ..., outcome: 'state_nonce_mismatch' });
```
This means the audit/security trail cannot distinguish "disallowed domain" from "blocked account" from an actual state/nonce mismatch — undermining the security-event auditability the spec calls for.

### 2.5 🟡 Rate limiting is checked on the success path, not the failure path
`assertClientRateLimit` is only invoked after `verified` identity resolves successfully (right before `findOrCreateUser`). It does correctly block session creation once 5 failures have accumulated in the failure log, so the outcome is roughly correct, but the check reads oddly (identity is fully verified before the throttle check even runs) and offers no early rejection for high-volume failing traffic before that point.

### 2.6 ⚪ `challenge` issuance has no explicit rate limit
Spec: *"challenge issuance is rate-limited per account and device."* `createChallenge` has no such check — any authenticated flow can request unlimited challenges.

---

## 3. Domain 2 — Courses & Enrollment (largely unimplemented)

**Only 1 of 12 documented endpoints exists**, and it is a stub:

```ts
// professor-teaching-claim.controller.ts — entire file
@Controller('api/v1/professor')
export class ProfessorTeachingClaimController {
  @Get('teaching-claims')
  async findAll() {
    return this.professorTeachingClaimService.findAll(); // no auth guard, no filtering
  }
}
```

### 3.1 🔴 No course/enrollment API surface at all
Missing entirely: `GET /courses`, `GET /courses/{id}`, `GET /courses/{id}/groups`, `GET /enrollments`, `POST /enrollments`, `POST /enrollments/{id}/drop`, `POST /enrollments/switch`, `GET /courses/{id}/groups/{id}/eligibility`, `GET /students/me/courses`. There is no `EnrollmentController`/`EnrollmentService` anywhere in the codebase. Yet `TimetableService` directly queries the `Enrollment` table to build a student's timetable — meaning **there is no way for a student to actually enroll in a course group through the API**, even though the timetable feature depends on enrollment records existing. Since `apps/mobile` also has no screens calling any of this, the entire enrollment lifecycle described in Module 3 has no working path from end to end.

### 3.2 🔴 `GET /professor/teaching-claims` has no auth guard and leaks all professors' data
No `@UseGuards(AuthGuard)` on the controller or method — this is a genuinely **unauthenticated** endpoint. `findAll()` returns every `ProfessorTeachingClaim` row for every professor with no filtering by the caller, contradicting the spec's "current professor only" authorization rule.

### 3.3 🟠 No claim creation, release, or admin assignment/revocation endpoints
`POST /professor/teaching-claims` (self-claim) and `DELETE /professor/teaching-claims/{claimId}` (release) from `domain-02` are both missing, as is the admin assignment endpoint `POST /admin/teaching-claims` from `domain-09`. There is no way to create a `ProfessorTeachingClaim` through the API at all — which, combined with §5.3 below, means the announcement feature can never succeed against a real deployment.

---

## 4. Domain 3 — Timetable & Personal Scheduling (implemented, but buggy)

All 8 endpoints exist as routes, but several core behaviors are wrong or missing.

### 4.1 🟠 Conflict severity is hardcoded to `'hard'`
`timetable.service.ts` `checkConflicts`:
```ts
const conflicts: ConflictResult[] = overlappingEvents.map((event) => ({
  severity: 'hard', // Could be soft or hard based on overlap percentage
  ...
```
The code comment admits this. Module 3 Business Rule #4 explicitly requires hard/soft distinction, and Acceptance Criterion #4 tests for it. No overlap-percentage or event-type-based logic exists.

### 4.2 🟠 Recurring-event `scope` (`this_occurrence` / `this_and_future` / `entire_series`) is accepted but ignored
`UpdatePersonalEventDto` includes a `scope` field, matching the documented contract, but `TimetableService.updatePersonalEvent`/`deletePersonalEvent` never read `dto.scope` — they simply mutate or delete the single `PersonalEvent` row. There is no `personal_event_exceptions` entity/table anywhere in the codebase (confirmed — only `official-event.entity.ts` and `personal-event.entity.ts` exist under `timetable/entities`). Module 3 Business Rule #10 and the entire "Recurring personal-event update and delete operations must support scope semantics" section of `domain-03` (exception rows, series splitting) is unimplemented. A user editing "just this Tuesday" of a recurring event will instead silently edit/delete the *entire* series.

### 4.3 🟠 Timetable range query uses strict containment instead of overlap
```ts
.andWhere('event.startDatetime >= :startDateTime', { startDateTime })
.andWhere('event.endDatetime <= :endDateTime', { endDateTime })
```
This requires the *entire* event to fall inside `[startDate, endDate]`. An event that starts before the requested window and ends inside it (or vice versa) is silently dropped from the results. The conflict-check method in the same file correctly uses overlap logic (`start < end AND end > start`) a few functions later — the timetable query should use the same pattern.

### 4.4 🟠 Official event detail / group-events endpoints reject professors and admins
`getOfficialEventDetail` and `getOfficialEventsForCourseGroup` both only check for an **active student enrollment** row and throw `ForbiddenException` otherwise:
```ts
if (!enrollment) throw new ForbiddenException('You are not authorized to view this event');
```
The spec explicitly requires: *"student must be enrolled … professor must have an active teaching claim … or caller must be an authorized admin."* As written, a professor or admin calling these endpoints for their own course always gets a 403.

### 4.5 🟡 No TBA normalization in API responses
`OfficialEvent.location` is returned as raw `null` with no transformation to the `"TBA"` string the UI is supposed to render consistently (Module 3 #6). This may be intentionally left to the frontend, but nothing in the API or DTO layer guarantees the value is display-safe.

---

## 5. Domain 5 — Notifications & Announcements

### 5.1 🔴 No reminder-generation pipeline exists
There is no scheduler, cron job, queue consumer, or any background process in the entire repo that turns an upcoming `OfficialEvent`/`PersonalEvent` into a `Notification` row at the 1-day/3-hour/1-hour/due-time windows required by Module 5 #1. `NotificationService.generateIdempotencyKey()` is defined (correctly, hashing recipient+event+window+channel) but is **never invoked anywhere in the codebase**. This is the single biggest functional gap relative to the product's stated goals.

### 5.2 🔴 Admin notification operations are hard-coded stubs
`AdminNotificationController` in `notifications.controller.ts`:
```ts
@Get('notifications/:notificationId/delivery-status')
async getDeliveryStatus(...) {
  // Stub: return empty for now
  return { status: 'success', data: { notificationId, channel: 'in_app', status: 'delivered', deliveredAt: new Date() } };
}

@Get('notifications')
async listFailedNotifications(...) {
  // Stub: return empty list for now
  return { status: 'success', data: [], nextCursor: undefined };
}

@Post('notifications/:notificationId/retry')
async retryNotification(...) {
  // Stub: acknowledge retry request
  return { status: 'success', message: 'Retry request accepted', data: { notificationId, status: 'queued' } };
}
```
These never query the real `Notification`/`NotificationDeliveryLog` tables. `getDeliveryStatus` will report **every** notification as `delivered` regardless of actual state — actively misleading for the operational-troubleshooting use case the endpoint exists for (Requirement: "notification and import failures must be observable").

### 5.3 🟠 Teaching-claim check in `publishAnnouncement` uses the wrong comparison and can never succeed for legitimately-created claims
```ts
const teachingClaim = await this.teachingClaimRepository.findOne({
  where: { professorId: userId, courseGroupId: dto.courseGroupId, verifiedAt: MoreThan(new Date()) },
});
```
`verifiedAt` (per the entity) is the timestamp *when* a claim was verified — i.e., a value in the **past**. `MoreThan(new Date())` only matches rows where `verifiedAt` is in the **future**, which will essentially never be true for a claim verified through normal use. This condition appears to be inverted; it should likely check that `verifiedAt IS NOT NULL` and `releasedAt IS NULL`. Combined with §3.3 (no way to create a claim via the API at all), announcement publishing has no viable path to success in the current system.

### 5.4 🟠 No daily announcement cap
`publishAnnouncement` has no logic counting prior announcements for the course/day. Module 5 Business Rule #6 and Acceptance Criterion #3 ("Given announcement posting beyond daily cap … publication is blocked") are unimplemented.

### 5.5 🟠 Mute and preference state are never consulted
`getMutedCourses`/`muteCourse`/`unmuteCourse` and `getPreferences`/`updatePreferences` are pure CRUD with no consumer. Nothing in `publishAnnouncement`, `getNotificationFeed`, or (absent) dispatch logic checks `remindersEnabled`, `announcementsEnabled`, or `MutedCourse` rows before creating/showing a notification. Module 5 Business Rules #1, #3, #5 ("Duplicate notification … prevented," "muted user does not receive that course announcement") have no enforcement point to hook into, since no dispatch code exists at all (see 5.1).

### 5.6 🟠 Announcement read endpoints have no eligibility check — explicit stub comment
```ts
async getAnnouncementDetail(announcementId: string, userId: string): Promise<Announcement> {
  ...
  // Check if user is eligible (enrolled in group or is professor/admin)
  // Stub: allow all for now
  return announcement;
}
```
Any authenticated user can read any announcement by ID or list any course group's announcements, regardless of enrollment. This directly contradicts Module 5 Business Rule #11 and is a real information-disclosure issue (announcements may contain course-specific/sensitive content intended only for enrolled students).

### 5.7 🟡 Notification feed pagination cursor has no tiebreaker
`getNotificationFeed` cursors strictly on `createdAt` (`n.createdAt < :cursor`) with no secondary `id` ordering. Rows sharing an identical timestamp can be skipped or duplicated across pages. (`markAllAsRead`, by contrast, correctly orders `createdAt, id` — the same pattern should be applied here.)

---

## 6. Domain 6 — FAQ & Moderation

### 6.1 🔴 Admin moderation surface is entirely missing
`FaqController` is the only controller in the module (`@Controller('api/v1/faq')`). None of these documented endpoints exist anywhere in the codebase:
- `POST /admin/faq/questions/{questionId}/lock`
- `POST /admin/faq/questions/{questionId}/unlock`
- `GET /admin/faq/reports`
- `POST /admin/faq/reports/{reportId}/resolve`

Reports can be **created** (`POST /faq/reports`) but never viewed or resolved by anyone — `Report` rows accumulate with no admin-facing workflow, so "Content can be reported for moderation" (Module 6 #9) is only half-built.

### 6.2 🟠 `reopenQuestion` cannot actually be used by professors/admins — role check compares the wrong value
`faq.service.ts`:
```ts
async reopenQuestion(userId: string, questionId: string): Promise<Question> {
  ...
  if (question.authorId !== userId && !['professor', 'admin'].includes(userId)) {
    throw new ForbiddenException('You cannot reopen this question');
  }
  ...
}
```
This compares the caller's **user ID** (a UUID) against the literal strings `'professor'`/`'admin'` — it should be comparing an **actorRole** parameter (as `acceptAnswer`/`unacceptAnswer` correctly do a few functions above). Because `userId` will never literally equal `"professor"` or `"admin"`, this condition is always true unless the caller is the original author, meaning **only the question's own asker can ever reopen it** in practice — professors and admins are silently blocked, contradicting Module 6 #6 ("can be reopened by asker, professor, or admin"). The controller doesn't even pass the caller's role into this method, so the fix requires a signature change.

### 6.3 🟠 Votes cannot be changed — they can only be cast once and then rejected forever
```ts
async createQuestionVote(...) {
  const existing = await this.questionVoteRepository.findOne({ where: { userId, questionId } });
  if (existing) {
    throw new BadRequestException('You have already voted on this question');
  }
  ...
}
```
(Same pattern in `createAnswerVote`.) Module 6 Business Rule #1 explicitly states votes are "one per user per item and **can be changed**." As implemented, a user who wants to switch their vote from down to up must call `DELETE /votes` then `POST /votes` again as two separate calls — and if the client (reasonably, per the spec) just calls `POST` again with a new value, it is rejected outright. This should instead update `existing.value` when a vote already exists.

### 6.4 🟠 "Sort by popularity" is not implemented — dead ternary
```ts
qb.orderBy(query.sort === 'popular' ? 'question.createdAt' : 'question.createdAt', 'DESC');
```
Both branches of the ternary are identical (`question.createdAt`). Regardless of the `sort` query parameter, results are always ordered by recency. Module 6 #6 ("FAQs support sorting by recency and popularity") is only half-true — popularity sort silently falls back to recency with no error or indication.

### 6.5 🟡 Edit window is fixed at 7 days, not configurable
`createQuestion` hard-codes `editWindowExpiresAt: new Date(Date.now() + 1000*60*60*24*7)`. Business Rule #5 says the duration should be "fixed and configurable" — there's no `system_config` lookup or env var, so an admin cannot change it without a code deploy.

---

## 7. Domain 4 — Admin Schedule Import (Excel)

(See §0 item 2 for the headline finding — the parser never runs and no `OfficialEvent` rows are ever created.)

### 7.1 🔴 `validateImportFile` is a stub that always passes
```ts
private async validateImportFile(fileBuffer: Buffer): Promise<ImportValidationResult> {
  // Stub validation: in production, would parse Excel/CSV and validate against schema
  // For now, accept any file with header row
  const errors = [];
  return { isValid: errors.length === 0, errors, rowCount: 1 };
}
```
No Excel parsing, no template-version check, no field-level validation (course code/group/date/time/location), no duplicate-row detection. Every Module 4 requirement about validation (#3, #4, #6, and Business Rule #1) and their Acceptance Criteria (#2, #4) are unmet — literally any uploaded file (even an empty one) is marked `validated`.

### 7.2 🔴 `applyImport` never writes any `OfficialEvent` rows
`applyImport` creates a `DatasetVersion` and flips the `isCurrent` flag, but nowhere in the method (or anywhere else in the service) is `OfficialEvent` ever created from parsed row data — because no rows were ever parsed (§7.1). A "successful" import produces a dataset version with **zero events**, silently breaking the entire student-facing timetable.

### 7.3 🔴 `rollbackImport` can leave two `DatasetVersion` rows marked `isCurrent: true` for the same term
```ts
currentVersion.isCurrent = false;
await queryRunner.manager.save(currentVersion);

targetVersion.isCurrent = true;   // (1) reactivates the OLD target row
await queryRunner.manager.save(targetVersion);

const rollbackVersion = queryRunner.manager.create(DatasetVersion, {
  term: dto.term,
  importBatchId: targetVersion.importBatchId,
  previousVersionId: currentVersion.id,
  isCurrent: true,               // (2) ALSO marks a brand-new row current
});
const savedRollback = await queryRunner.manager.save(rollbackVersion);
```
This sets `isCurrent = true` on **two different rows** in the same transaction: the reactivated `targetVersion` and the newly created `rollbackVersion`. This violates the explicitly stated invariant ("single current flag per term," `domain-04` Core Principle #6) and will make any subsequent `findOne({ where: { term, isCurrent: true } })` call (used by `getCurrentDataset`, and by `applyImport`'s "get previous current version" step) non-deterministic — it may or may not pick up the row that actually has the real `OfficialEvent` associations, and the next apply/rollback may fail to flip the *other* current row back to false, compounding the corruption over time.

**Fix:** Rollback should either (a) just flip `targetVersion.isCurrent = true` and record the rollback as an audit-log entry without creating a redundant new "current" row, or (b) if a new version row is required for immutable history purposes, it must carry over `OfficialEvent` references from the target version rather than leaving two rows simultaneously flagged current.

### 7.4 🔴 `getImportDiff` is a hard-coded stub
```ts
async getImportDiff(batchId: string): Promise<ImportDiff> {
  ...
  // Stub diff calculation: in production, would parse import and compare to current events
  return { addCount: 0, updateCount: 0, removeCount: 0 };
}
```
Always returns zero for every count. Acceptance Criterion #5 ("add, update, and removal counts are displayed") cannot pass, and the destructive-change confirmation flow (Core Principle in `domain-04`, requirement #11 in `requirements.md`) has no data to act on — it's simply not possible to detect "large removal" with this stub.

### 7.5 🟠 No step-up re-authentication check before apply/rollback
`applyImport(batchId, userId, dto)` and `rollbackImport(userId, dto)` never call `ensureFreshStepUp` (which exists and is used correctly elsewhere, e.g. `setUserRole`/`setAccountStatus`). Security Requirement #8 ("Privileged admin actions … require step-up re-authentication valid for 10 minutes") and the explicit `domain-04` requirement ("require a fresh step-up verification within the last 10 minutes before a publish or rollback action proceeds") are both violated. Neither method even accepts a `sessionId` parameter to perform the check.

### 7.6 🟡 File upload validation is incomplete
`admin-import.controller.ts` sets a 50MB size limit via `FileInterceptor`, but there is no MIME-type/extension whitelist, no filename whitelist, no row-count limit, and no malware/antivirus scanning — all explicitly required by `domain-04` §1 and Security Requirement #10.

### 7.7 🟡 Idempotent-apply behavior is implemented at upload time as a hard rejection, not at apply time as a graceful no-op
The spec wants: *"if the same content_hash was already applied for the same term … return the existing current dataset version without creating a duplicate published version"* (at apply time). The implementation instead throws a `ConflictException` at **upload** time if a batch with that hash was already `applied` for the term — which blocks even *re-uploading* the same file for inspection, rather than gracefully returning the existing version when someone tries to *apply* it again. There's also no protection against the literal "concurrent apply requests" race the spec calls out (no DB unique constraint visible, and the tables in question have no migration at all — see §0.1).

---

## 8. Domain 7 — Profiles, Contact & Office Hours

### 8.1 🔴 Office-hours document upload/delete has no ownership or admin check — any authenticated user can modify any professor's document
```ts
// profile.controller.ts
@Post('professors/:userId/office-hours')
async upsertProfessorOfficeHours(@Req() req: any, @Param('userId') userId: string, @Body() dto: any) {
  ...
  return { status: 'success', data: await this.profileService.upsertProfessorOfficeHours(userId, dto) };
  //                                                                    ^ req.user.id is never read or checked
}
```
```ts
// profile.service.ts
async upsertProfessorOfficeHours(professorId: string, dto: {...}) {
  const professor = await this.userRepository.findOne({ where: { id: professorId } });
  ...
  // no comparison against an actor/caller id anywhere in this method
}
```
Same pattern in `deleteProfessorOfficeHours(professorId)`. Neither the controller nor the service ever compares the authenticated caller to the target professor, and there's no `@Roles(...)` guard restricting these routes either. Module 7 Business Rule #8 states plainly: *"only the professor owner or an authorized admin may upload or delete a document for that professor."* As written, **any logged-in student can overwrite or delete any professor's office-hours document.** This is a genuine, exploitable authorization vulnerability, not just a spec mismatch.

**Fix:** Pass `req.user.id`/`req.user.role` into both service methods and reject unless `professorId === callerId` or `callerRole === 'admin'`.

### 8.2 🟠 "Private storage with short-lived signed URLs" is not implemented
`ProfessorScheduleDocument` stores a plain `fileUrl` string with no evidence of signed-URL generation or re-authorization at download time. Module 7 Business Rule #8's second half ("Office-hours documents use private storage and short-lived signed URLs; authorization is rechecked at download time") appears entirely unaddressed — documents are served via whatever static URL was stored, and there is no download endpoint that re-checks authorization.

### 8.3 🟠 `POST /profile/photo` is missing
Documented in `domain-07` as its own endpoint (photo upload, presumably multipart with its own validation), but `ProfileController` has no `photo` route at all. `updateProfile` does accept a `photoUrl` string field, so photo changes are only possible by passing a pre-hosted URL, not by uploading a file through the API.

### 8.4 ⚪ Office-hours update endpoint uses `POST`, spec says `PUT`
`domain-07` documents `PUT /api/v1/professors/{userId}/office-hours`; the controller implements it as `POST`. Functionally an upsert either way, but it's a literal contract mismatch a strictly-typed client generated from the docs would trip over.

---

## 9. Domain 8 — Account Lifecycle & Deletion

- Endpoints exist but are mounted at `/api/v1/auth/account/deletion` instead of the documented `/api/v1/account/deletion` (see §1.5).
- `processDeletionRequest` (`auth.service.ts`) sets `user.accountStatus = 'deletion_pending'` both when a deletion is **requested** and again when it **completes** — there's no distinct terminal status, so an admin querying `accountStatus` can't tell "still pending" from "already anonymized/completed" by looking at the user row alone (they'd have to cross-reference the `DeletionRequest.status` separately, which does correctly move to `'completed'`). Minor but worth cleaning up for clarity/observability.
- `setLegalHold` correctly blocks `processDeletionRequest` via `request.legalHoldReason`, matching Module 8 #5.
- Cancellation (`cancelDeletionRequest`) does not require "fresh step-up verification" as literally specified in Module 8 #3 / API design — the auth controller's `POST /account/deletion/cancel` handler doesn't call `ensureFreshStepUp`.

---

## 10. Domain 9 — Admin Operations & System Controls

- Most endpoints exist and are functionally reasonable (`setAccountStatus` correctly revokes sessions on suspend/block, last-admin-protection is implemented for both role changes and status changes, audit logging is wired through most admin mutations).
- 🟠 `setUserRole` does **not** revoke active sessions after a role change, unlike `setAccountStatus`. Module 9 Acceptance Criterion #2 ("Admin role or account-status changes immediately invalidate affected active sessions") explicitly covers *role* changes too. In practice the live-read of `session.user.role` in `AuthGuard` means a demoted/promoted user's *authorization* is correct on their very next request, but their *session itself* is not invalidated as the spec requires — this is a defense-in-depth gap (e.g., it means a demoted admin's existing session isn't force-terminated, only permission-checked).
- 🟠 `POST /admin/teaching-claims` (admin assign/revoke a teaching claim, `domain-09`) does not exist anywhere — consistent with §3.3.
- See §1.5 for the routing-prefix inconsistency affecting most of this domain's endpoints.

---

## 11. Cross-cutting notes

- **Mobile app is far behind the API surface.** `apps/mobile/src` contains only 11 files (`auth/`, `api/`, `config/`, `theme/`) and calls exactly two backend routes in total (`v1/auth/google/callback`, `v1/auth/logout`). There are no timetable, course, notification, FAQ, or profile screens yet, so most of the backend gaps above have not yet surfaced as visible product bugs — but they will block frontend work the moment those screens are started.
- **Test coverage exists but is narrow.** `*.spec.ts` files exist per module (auth, courses, faq, notifications, profile, timetable), which is good practice, but given the stubs found above (import validation, notification delivery status, announcement eligibility), it's likely these tests exercise the happy-path CRUD rather than the missing business rules — worth an explicit coverage pass once the gaps above are fixed.
- **`docs/test.md`** in this repo already contains a partial, independent audit of the **database design** (not the implementation) that flags several of the same root issues from a different angle (e.g., missing rate-limit constraints at the DB layer, notification idempotency key not unique-constrained) — worth reading alongside this report since the two overlap on some root causes (e.g., §0.1 here explains why several of those DB-design concerns can't even be checked against a live schema).

---

## 12. Suggested prioritization

1. **Fix the missing migrations first** (§0.1). Nothing else can be verified end-to-end without a real database matching the entities.
2. **Close the two authentication bypasses** (§1.1, §1.2) and add CSRF/Origin protection (§1.3) — these are exploitable today, not just spec drift.
3. **Fix the office-hours authorization hole** (§8.1) — same category of severity as #2, just scoped to one feature.
4. **Decide the real scope of MVP for this pass**: either build out Courses/Enrollment (§3) and the Excel import parser (§7.1–7.4) for real, or explicitly re-scope requirements.md if those are being deferred — right now the docs promise a working pipeline that doesn't exist, which will surprise whoever builds the frontend against them.
5. **Reminder dispatch** (§5.1) is the actual product differentiator per the stated Product Goals — worth prioritizing once the data pipeline in #4 exists, since reminders need real `OfficialEvent` rows to fire against.
6. **Standardize route prefixes** (§1.5) — cheap, mechanical fix that removes a whole class of "works locally, breaks against the documented contract" bugs.
7. Sweep the remaining 🟡/⚪ items (vote-change semantics, reopen-question role bug, popularity sort, TBA normalization, cursor tiebreakers) as routine bug-fix cleanup once the above are settled.
