# NEU Companion — Project Context for Copilot

This file is auto-loaded into every Copilot Chat/agent session in this repo.
Do not ask the user to re-explain stack, structure, or docs — read the files below.

## What this project is
NEU Companion is a university companion platform. Monorepo, Node.js/TypeScript.

## Source of truth (always check these before answering or coding)
- Requirements (business rules, actor model, acceptance criteria): `docs/requirements.md`
- Database design (schema, constraints, invariants): `docs/database-design.md`
- API domain map (domain boundaries, design principles): `docs/api-design/api-domains.md`
- Per-domain API contracts: `docs/api-design/domain-XX-*.md` (9 domains, see map above for which file owns which capability)
- Milestones / current progress (what's done, what's next): `docs/milestones.md`
- Implementation plan (granular task breakdown): `docs/implementation-plan.md`
- Full tech stack detail: `TECH_STACK.md`

Never invent requirements, endpoints, or schema. If something needed isn't covered
in these docs, say so explicitly instead of guessing.

## Tech stack (summary — see TECH_STACK.md for full detail)
- Backend: NestJS 11 (Express adapter), TypeScript 5.9, Node 22
- ORM: TypeORM, PostgreSQL 16 (Docker)
- Cache/session store: Redis 7 (Docker) — reserved, not fully wired yet
- Auth: Google OAuth via `google-auth-library`, cookie-based sessions, custom RBAC guards/decorators
- Validation: class-validator / class-transformer
- Testing: Jest + ts-jest + @nestjs/testing

## Repo structure
- `apps/api` — the NestJS backend (the only app workspace right now; a mobile app
  under `apps/` is planned per the implementation plan but not started)
- `docs/` — all source-of-truth documentation described above

## Working conventions
1. Domains follow user-facing business capabilities, not raw DB tables (see api-domains.md
   design principles) — don't restructure this without flagging it.
2. Authorization is a shared enforcement layer (guards/decorators), not its own domain/module.
3. Audit logging is a side effect of business flows, not a feature to build standalone.
4. Follow the existing NestJS module structure under `apps/api/src` — one module per domain,
   decorator-based DI, repository pattern via TypeORM.
5. Any schema or requirements change must be flagged as a deviation, not made silently.
6. Match the request/response shapes already defined in the relevant
   `docs/api-design/domain-XX-*.md` file exactly — don't invent new fields or endpoints.

## Current state (high-level — see docs/milestones.md for the live detail)
- Milestone 1 (design/docs) and most of Milestone 2 (project scaffolding) are complete.
- Milestone 3 (core backend): Auth/Identity domain is largely implemented (sessions, RBAC,
  admin controls, challenge flows). Google OAuth live-callback verification is still partial.
  Courses/Enrollment, Timetable, Notifications, Admin Import, Deletion, FAQ/Moderation, and
  Profiles/Office Hours domains have not been started yet.
- Always confirm current status against `docs/milestones.md` directly — it's updated more
  often than this file.

## When starting a new chat/session for a specific task
Don't wait to be told the stack or where docs live — it's all above. Just ask (or infer from
`docs/milestones.md`) which specific task/milestone is being worked on, then go straight to
the relevant domain doc(s).
