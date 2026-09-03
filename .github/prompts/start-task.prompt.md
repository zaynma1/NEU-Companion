---
agent: agent
---
You are starting a fresh session on the NEU Companion backend.

0. First, check `docs/remediation-and-frontend-plan.md` for any unchecked (`- [ ]`) item in
   Phases B0–B5. If any exist, **stop here** and tell the user this session should use
   `.github/prompts/fix-known-issues.prompt.md` instead — that file walks the known-issue list
   in the correct order, one item at a time. This file (`start-task.prompt.md`) is only for
   backend work that is genuinely new and not already covered by the remediation plan (e.g. a
   feature the user is adding on top of an already-remediated domain).
1. Read `docs/milestones.md` and identify the next unchecked (`- [ ]`) task, respecting the
   order milestones/items already appear in (don't skip ahead unless the user tells you to).
   Treat this file's checkbox state with some skepticism — cross-check against
   `docs/remediation-and-frontend-plan.md` and `docs/backend-audit-report.md` if something marked
   done doesn't match what you find in the code, and flag the discrepancy to the user rather than
   silently trusting either source.
2. Cross-reference `docs/requirements.md` for the business rules / acceptance criteria relevant
   to that task's domain.
3. Cross-reference `docs/api-design/api-domains.md` to confirm which domain file owns this task,
   then open the specific `docs/api-design/domain-XX-*.md` file for the exact contract (routes,
   payloads, validation rules).
4. Cross-reference `docs/database-design.md` for any entities/columns/constraints involved.
5. Summarize back to the user: which task you picked, which domain/API doc and DB tables
   it touches, and a short implementation plan. **Wait for confirmation before writing code.**
6. Once confirmed, implement inside `apps/api/src`, following existing module structure
   and conventions in `.github/copilot-instructions.md`.
7. When done, tell the user exactly which checklist item(s) in `docs/milestones.md` to
   check off — don't edit that file yourself unless asked.
