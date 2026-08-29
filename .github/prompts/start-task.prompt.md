---
agent: agent
---
You are starting a fresh session on the NEU Companion backend.

1. Read #file:../../docs/milestones.md and identify the next unchecked (`- [ ]`) task,
   respecting the order milestones/items already appear in (don't skip ahead unless the
   user tells you to).
2. Cross-reference #file:../../docs/requirements.md for the business rules / acceptance
   criteria relevant to that task's domain.
3. Cross-reference #file:../../docs/api-design/api-domains.md to confirm which domain
   file owns this task, then open the specific `docs/api-design/domain-XX-*.md` file
   for the exact contract (routes, payloads, validation rules).
4. Cross-reference #file:../../docs/database-design.md for any entities/columns/constraints
   involved.
5. Summarize back to the user: which task you picked, which domain/API doc and DB tables
   it touches, and a short implementation plan. **Wait for confirmation before writing code.**
6. Once confirmed, implement inside `apps/api/src`, following existing module structure
   and conventions in `.github/copilot-instructions.md`.
7. When done, tell the user exactly which checklist item(s) in `docs/milestones.md` to
   check off — don't edit that file yourself unless asked.
