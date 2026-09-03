---
agent: agent
---
You are running a remediation session on NEU Companion. The backend has a known-issue list
from a full code audit (`docs/backend-audit-report.md`), sorted into a fix order in
`docs/remediation-and-frontend-plan.md`. This is a collaborative, **one item at a time** session
between you and the user — never batch multiple fixes into one pass, and never move to the next
item until the user has confirmed the current one is actually done.

## Steps for each item

1. Open `docs/remediation-and-frontend-plan.md` and find the **first unchecked** (`- [ ]`) item,
   respecting phase order: Phase B0 before B1 before B2 before B3 before B4 before B5. Don't
   skip ahead to a later phase because it looks easier or more interesting, unless the user
   explicitly tells you to jump.
2. That item cites an audit section (e.g. "audit §1.1"). Open `docs/backend-audit-report.md` and
   read the full finding — the exact file, line number, code snippet, and the report's own
   suggested fix. Don't work from the plan's one-line summary alone; the report has the detail.
3. Cross-reference whatever else is relevant before proposing anything:
   - `docs/api-design/domain-XX-*.md` for the exact contract this touches (find the owning
     domain via `docs/api-design/api-domains.md` first if it's not obvious)
   - `docs/database-design.md` for any entities/columns/constraints involved
   - `docs/requirements.md` for the business rule or acceptance criterion being violated
4. Summarize back to the user, in this order, then **stop and wait**:
   a. Which item you picked, with its audit citation and file location
   b. The current (broken) behavior, in a sentence or two — not the whole audit quote
   c. Your proposed fix
   d. A proposed test for this fix (see "Testing" below) — be specific about what it checks,
      not just "add a test"
   Do not write any code until the user confirms this plan.
5. Once confirmed, implement the fix inside `apps/api/src` (or `apps/mobile` if the item is
   frontend-side), following existing module structure and `.github/copilot-instructions.md`.
6. Write and run the test from step 4d. Show the user it passing — or, if it's a manual
   verification item, show the actual verification output (migration ran, curl result, etc.)
   — before treating the item as done. Don't skip this step even if the fix looks obviously
   correct.
7. Tell the user exactly which checkbox to check off in `docs/remediation-and-frontend-plan.md`,
   and name the corresponding line/section in `docs/backend-audit-report.md` this resolves.
   Don't edit either file yourself unless asked.
8. **Stop.** Don't start the next item in the same response — wait to be told to continue, or
   for the user to ask you to move to the next one.

## Testing — every item gets one if a test is possible

- **Bug fixes and new endpoints:** a Jest spec (`*.spec.ts` next to the file being changed,
  using `@nestjs/testing` like the existing specs) that fails against the old behavior and
  passes against the new one. Name the `describe` block after the audit citation, e.g.
  `describe('audit 6.3 - votes can be changed', ...)`, so a future reader can trace the test
  back to the finding without re-reading the whole audit.
- **Security fixes** (auth bypasses, CSRF, device fingerprinting, the office-hours authorization
  hole): the test should attempt the actual exploit described in the audit finding and assert
  it's now rejected — not just a happy-path test that the "correct" flow still works. A security
  fix without a test that tries the attack isn't verified.
- **Migration/infrastructure items** (Phase B0, most of B5): there's no unit test. The
  verification step is running the migration against a real Postgres instance and confirming the
  expected tables/columns exist (e.g. `\dt` in `psql`, or a quick query). Say this explicitly
  instead of silently skipping the testing step.
- **Route/config-only changes** (prefix standardization, `POST`→`PUT`): no unit test needed if
  existing integration tests already cover the route. Otherwise, verification is a manual
  request against the corrected path confirming it resolves instead of 404ing — show the actual
  request/response.
- If you genuinely can't think of a reasonable way to verify an item, say so explicitly and ask
  the user how they'd like to verify it. Don't mark something done without an agreed way to
  check it, even informally.

## Rules for this session

- One item at a time, full stop between items — this file exists specifically so the user
  doesn't get a wall of unrelated changes to review at once.
- If an item turns out to depend on an earlier item that's still unchecked (e.g. a Domain 2 fix
  that needs the Phase B0 migrations first), stop and say so instead of improvising a workaround
  or reordering the plan yourself.
- If a fix requires a decision the audit didn't make for you (e.g. which CSRF strategy, which
  queue library for the reminder dispatcher in §5.1), present the realistic options briefly and
  ask which the user wants — don't pick silently on their behalf.
- Never mark an item done on the strength of code review alone if it needed a running test or
  manual verification — same standard `.github/copilot-instructions.md` already holds for
  frontend milestone items.
- If the user wants to skip an item (defer it on purpose), that's their call — note it, move to
  the next one, and don't argue the priority call more than once.
