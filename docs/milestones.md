# Milestones

We are following the phased plan and tracking the repo against the real implementation state.

## Milestone 1 — Baseline sign-off
Status: Complete

- [x] Requirements are documented
- [x] Domain contracts are documented
- [x] Database model is defined
- [x] Cross-domain inconsistencies were reconciled
- [x] Product identity was aligned to NEU Companion

Deliverables:
- final reviewed design pack
- clear scope boundaries
- decision log for assumptions and trade-offs

## Milestone 2 — Implementation readiness
Status: In progress

- [x] Backend stack and runtime were selected
- [x] Project structure was initialized for the API workspace
- [x] Local Docker/dev environment was defined
- [x] Env/config management is in place
- [x] Auth/session infrastructure was scaffolded
- [x] CI/CD flow is still pending

Deliverables:
- app skeleton
- config schema
- Docker/dev setup
- migration tooling plan

## Milestone 3 — Core backend foundation
Status: In progress

- [x] Auth and identity shell is implemented
- [x] User/session models are aligned with the approved schema
- [x] Session cookie validation, logout, and revocation flows are implemented
- [x] Challenge issuance and verification flows are implemented
- [x] Google OAuth provider setup is wired for local validation and real provider configuration
- [x] Real Google callback verification against the live provider is partial / still pending for end-to-end confirmation
- [x] Core permissions and admin controls are implemented, including RBAC, fresh step-up verification, audit logging, user search, account status management, professor verification, and system configuration
- [x] Professor teaching-assignment management is implemented
- [x] Course + enrollment foundation is implemented
- [x] Timetable + personal event entities and official-event model are defined
- [x] Timetable API surface with CRUD operations, conflict detection, and scope semantics is implemented
- [x] Admin import pipeline and dataset lifecycle management is implemented
- [x] Notifications and announcements are implemented
- [x] FAQ and moderation
- [x] Deletion lifecycle
- [x] Profiles and office hours
- [ ] Admin operations and system controls are pending

This keeps the foundation stable before feature expansion.

## Milestone 4 — Validation and hardening
Status: In progress

- [x] Build verification is active for the API workspace
- [x] Auth/session regression check exists
- [ ] Integration tests for the real OAuth flow are partial / pending a live-provider pass
- [ ] Permission matrix tests are pending
- [ ] Import/retry tests are pending
- [ ] Audit log integrity tests are pending
- [ ] Security challenge tests are pending



## Milestone 5 — Production prep
Status: Not started

- [ ] Backup/restore runbook
- [ ] Monitoring and alerting
- [ ] Rate limiting checks
- [ ] Deployment strategy
- [ ] Database migration process
- [ ] Incident playbook


