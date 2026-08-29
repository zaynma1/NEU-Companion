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
- [ ] CI/CD flow is still pending

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
- [ ] Real Google callback verification against the live provider is partial / still pending for end-to-end confirmation
- [x] Core permissions and admin controls are implemented, including RBAC, fresh step-up verification, audit logging, user search, account status management, professor verification, and system configuration
- [ ] Professor teaching-assignment management is still pending
- [ ] Course + enrollment foundation is pending
- [ ] Timetable + personal events are pending
- [ ] Notifications and announcements are pending
- [ ] Admin import pipeline is pending
- [ ] Deletion lifecycle is pending
- [ ] FAQ and moderation are pending
- [ ] Profiles and office hours are pending

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

## Recommended next steps
Status: Active

1. [ ] Verify the real Google OAuth client is configured in the environment and matches the redirect URI exactly.
2. [x] Start the API on the configured port and confirm the local health route responds successfully.
3. [ ] Hit the real Google start endpoint and confirm the provider redirect matches the backend callback URL.
4. [ ] Complete a live Google sign-in and confirm the callback receives a valid Google code or ID token.
5. [ ] Verify the callback creates or reuses the user, creates a session, sets the auth cookie, and returns the expected payload.
6. [ ] Add a real callback test and a local fallback regression to preserve the current behavior during future changes.
7. [x] Move to permissions and admin controls; they are implemented and ready for focused permission-matrix testing.
8. [ ] Start the Course + Enrollment foundation while live OAuth validation remains a tracked follow-up.

Current evidence:
- API build is green on the Nest project.
- Local app health endpoint responds successfully.
- Auth routes are mapped and reachable.
- Local validation is in place for the Google callback guard.
- The live Google callback remains only partially validated; the flow is not yet complete end-to-end.
- Admin operations are implemented; remaining work is focused permission-matrix testing, live provider verification, and regression hardening.

Deliverables:
- test suite
- edge-case checklists
- review sign-off

## Milestone 5 — Production prep
Status: Not started

- [ ] Backup/restore runbook
- [ ] Monitoring and alerting
- [ ] Rate limiting checks
- [ ] Deployment strategy
- [ ] Database migration process
- [ ] Incident playbook

## Immediate next step
Status: Active

- [ ] Course + enrollment foundation (next implementation slice)
- [ ] Google OAuth provider setup and callback wiring (partial: local logic exists, live provider validation remains pending)
- [ ] Allowed-domain enforcement tied to real Google identities
- [ ] Risk-based challenge flow for suspicious/sign-in edge cases
- [ ] Provider environment variables finalized in local config
