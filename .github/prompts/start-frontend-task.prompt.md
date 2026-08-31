---
agent: agent
---
You are starting a fresh session on the NEU Companion mobile frontend
(React Native + Expo), which is a separate track from the backend API work.

1. Read #file:../../docs/frontend-milestones.md and identify the next unchecked
   (`- [ ]`) task, respecting the milestone order already in the file (don't skip
   ahead to a later milestone unless the user explicitly says to).
2. If the task involves calling a backend endpoint or matching a data shape,
   cross-reference #file:../../docs/api-design/api-domains.md to find the owning
   domain, then open the specific `docs/api-design/domain-XX-*.md` file for the
   exact contract (routes, payloads, auth requirements).
3. If the task involves user-facing rules (roles, permissions, what a student vs.
   professor vs. admin can see/do), cross-reference #file:../../docs/requirements.md.
4. Confirm the current state of the mobile workspace before assuming anything
   exists — check whether `apps/mobile` (or similar) is present yet. Milestone 1
   has not started as of the last update, so early sessions may be building the
   app scaffold itself, not features inside it.
5. Summarize back to the user: which task you picked, which backend contract(s)
   or requirements it depends on, and a short implementation plan. **Wait for
   confirmation before writing code.**
6. Once confirmed, implement inside the mobile app workspace, matching whatever
   structure/conventions already exist there (or propose a sensible Expo project
   structure if this is the first task in Milestone 1).
7. When done, tell the user exactly which checklist item(s) in
   `docs/frontend-milestones.md` to check off — don't edit that file yourself
   unless asked.

Keep this session scoped to one task/milestone item. If the task turns out to
require backend changes that don't exist yet (e.g. an endpoint the API doesn't
expose), stop and flag that as a blocker rather than improvising a workaround.
