---
agent: agent
---
You are starting a fresh session on the NEU Companion mobile frontend
(React Native + Expo), which is a separate track from the backend API work.

1. Read `docs/frontend-milestones.md` and identify the next unchecked (`- [ ]`) task,
   respecting the milestone order already in the file (don't skip ahead to a later milestone
   unless the user explicitly says to).
2. Check that task against the screen inventory in `docs/remediation-and-frontend-plan.md` §2.
   If the screen is marked **(blocked)** there, **stop and say so** — name the specific backend
   Phase B item(s) it's blocked on, and ask the user whether to (a) build just the screen shell/
   empty state now and wire it up later, (b) pick a different, unblocked screen instead, or
   (c) switch this session to backend work via `.github/prompts/fix-known-issues.prompt.md`.
   Don't quietly build against an endpoint the audit already flagged as broken or missing.
3. If the task involves calling a backend endpoint or matching a data shape, cross-reference
   `docs/api-design/api-domains.md` to find the owning domain, then open the specific
   `docs/api-design/domain-XX-*.md` file for the exact contract (routes, payloads, auth
   requirements).
4. If the task involves user-facing rules (roles, permissions, what a student vs.
   professor vs. admin can see/do), cross-reference `docs/requirements.md`.
5. Confirm the current state of the mobile workspace before assuming anything
   exists — check whether `apps/mobile` (or similar) is present yet.
6. Summarize back to the user: which task you picked, which backend contract(s)
   or requirements it depends on, and a short implementation plan. **Wait for
   confirmation before writing code.**
7. Once confirmed, implement inside the mobile app workspace, matching whatever
   structure/conventions already exist there. Before marking the screen done, run it through
   the self-check at the bottom of `.github/instructions/mobile-design.instructions.md` — all
   eight rules, not just the token system.
8. When done, tell the user exactly which checklist item(s) in
   `docs/frontend-milestones.md` to check off — don't edit that file yourself
   unless asked.

Keep this session scoped to one task/milestone item. If the task turns out to
require backend changes that don't exist yet beyond what step 2 already caught, stop and flag
that as a blocker rather than improvising a workaround.
