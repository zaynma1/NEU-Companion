# NEU Companion Implementation Plan

This plan tracks the actual engineering work for the NEU Companion platform after the design and requirements pass. It is intentionally operational and status-based so the project can be executed in milestones.

## Status legend
- [ ] Not started
- [ ] In progress
- [x] Done
- [ ] Blocked

---

## 1. Foundation and repo setup

- [x] Initialize Git repository and remote
- [x] Standardize documentation structure under `docs/`
- [x] Create monorepo root configuration
- [x] Add Docker Compose for PostgreSQL + Redis
- [x] Add environment template
- [x] Initialize NestJS API workspace
- [x] Install dependencies successfully
- [x] Verify the app builds successfully (`npm run build`)
- [x] Add CI validation for build/lint/test on PRs

---

## 1A. Mobile-first frontend foundation

- [ ] Decide on cross-platform mobile stack: Expo + React Native for iOS and Android
- [ ] Create a dedicated mobile app workspace under the monorepo
- [ ] Design for phone-first layouts and small-screen constraints
- [ ] Add safe-area handling for iPhone notches and Dynamic Island
- [ ] Add device-safe spacing system for common phone widths
- [ ] Add responsiveness rules for small, medium, and large Android/iPhone sizes
- [ ] Define dark mode and light mode tokens
- [ ] Define touch target sizes and accessibility spacing rules
- [ ] Add local preview flow for simulator and physical device
- [ ] Add QA checklist for iOS vs Android visual parity

---

## 2. Core infrastructure and runtime

- [x] Create local `.env` from `.env.example`
- [x] Start PostgreSQL and Redis via Docker Compose
- [x] Verify database connectivity from the API
- [x] Add application configuration module (`ConfigModule`)
- [x] Add structured logging and request correlation
- [x] Add healthcheck endpoints
- [x] Add shared validation / error handling conventions

---

## 3. Database schema and migrations

- [x] Define PostgreSQL schema baseline for auth/users
- [x] Create initial migration for `users`
- [x] Create initial migration for `sessions`
- [x] Create initial migration for `auth_attempts`
- [x] Create initial migration for `challenges`
- [x] Create initial migration for `allowed_email_domains`
- [x] Create initial migration for `role_assignment_rules`
- [x] Create initial migration for `audit_logs`
- [x] Add indexing strategy for lookup-heavy queries
- [x] Add DB seed rules for admin/system config defaults

---

## 4. Auth and identity domain (Domain 1)

- [x] Set up TypeORM / repository layer for Postgres
- [x] Define user entity and auth-related entities
- [x] Implement Google OAuth login route
- [x] Implement allowed-domain enforcement
- [x] Add local-development Google fallback route for env-less testing
- [x] Implement identity parsing for student/staff status
- [x] Implement challenge generation and verification flow
- [x] Implement secure session creation with cookie + hash storage
- [x] Add session validation middleware / guard
- [x] Add logout and session revocation flow
- [x] Add step-up verification handling for sensitive actions
- [x] Add admin-config read flow for policy tables

---

## 5. Authorization and role model

- [x] Define RBAC / claims model for users
- [x] Implement role assignment logic from config rules
- [x] Add admin override paths
- [x] Add role-based guard infrastructure
- [x] Add permission checks for student / professor / admin flows
- [x] Add audit logging for role changes and policy updates

---

## 6. Course and enrollment domain (Domain 2)

- [x] Create course catalog entities
- [x] Create term / program entities
- [x] Create enrollment entities
- [x] Implement professor teaching self-claim workflow
- [x] Implement admin verification / approval workflow
- [x] Implement active-term enforcement
- [x] Add enrollment rules and status transitions
- [x] Add professor/course relationship checks

---

## 7. Timetable and personal schedule domain (Domain 3)

- [x] Define timetable and personal event entities
- [x] Define official event calendar model
- [x] Implement event creation / editing rules
- [x] Add personal event exception handling
- [x] Add conflict checks for personal schedules
- [x] Add user calendar retrieval APIs
- [x] Add schedule filters by term / date / ownership

---

## 8. Admin import and dataset lifecycle (Domain 4)

- [x] Create import job entities
- [x] Create validation result entities
- [x] Implement dataset upload lifecycle
- [x] Add row-level validation workflow
- [x] Add import retry and rollback semantics
- [x] Add admin review / approval flow
- [x] Add import status broadcast / notifications

---

## 9. Notifications and announcements (Domain 5)

- [x] Create notification entities
- [x] Create announcement entities
- [x] Create notification delivery records
- [x] Add idempotency keys for safe retries
- [x] Implement preference management (reminders, announcements)
- [x] Implement course muting for announcement suppression
- [x] Implement notification feed queries with read state tracking
- [x] Implement announcement publishing with professor verification
- [x] Add admin endpoints for delivery status and retry operations

---

## 10. FAQ and moderation (Domain 6)

- [x] Create FAQ question / answer entities
- [x] Add vote tracking and moderation state
- [x] Add moderation queue and approval flow
- [x] Add user question submission rules
- [x] Add answer acceptance logic

---

## 11. Profile, contact, and office hours (Domain 7)

- [x] Create profile entities
- [x] Create contact information model
- [x] Create office-hours schedule model
- [x] Add visibility rules for public/private profile data
- [x] Add signed URL or secure access flow for protected profile assets
- [x] Add profile edit and verification workflow

---

## 12. Account lifecycle and deletion (Domain 8)

- [x] Define deletion request and processing state model
- [x] Add anonymization workflow
- [x] Add account deactivation / suspension state transitions
- [x] Add personal event exception handling integration for deletion
- [x] Add retention and audit logging rules
- [x] Implement consumer-facing deletion confirmation flow

---

## 13. Admin operations and system controls (Domain 9)

- [x] Define admin configuration entities
- [x] Implement allowed-email-domain management API
- [x] Implement role assignment configuration API
- [x] Add audit log viewer and filtering
- [x] Add system alerts and status dashboards
- [x] Add role correction / verification tooling
- [x] Add platform control endpoints for operational actions

---

## 14. Security and operational hardening

- [x] Add rate limiting
- [ ] Add CSRF / cookie security hardening
- [ ] Add secure session rotation strategy
- [x] Add challenge replay protection
- [x] Add secret management via environment variables
- [x] Add request validation and sanitization
- [ ] Add observability / metrics
- [ ] Add error tracking and health monitoring

---

## 15. Testing and release readiness

- [x] Add unit tests for auth/session logic
- [x] Add integration tests for DB access and auth flows
- [ ] Add E2E tests for key user journeys
- [ ] Add API contract validation
- [ ] Add mobile UI regression checks for iOS and Android
- [ ] Add device preview checklist for small phone sizes, notch/Dynamic Island handling, and safe-area layout
- [x] Add smoke tests for Docker + Postgres + Redis startup
- [ ] Add deployment configuration for staging/prod
- [ ] Add release checklist and rollback procedure

---

## 16. Immediate next milestone

Based on the current repo state and the milestone tracker, the project has already passed the auth, domain, and validation foundation and is now in the production-prep phase. The next concrete milestone is:

1. Complete Production Prep tasks from Milestone 5:
   - rate limiting checks
   - deployment strategy
   - database migration process
   - incident playbook

## Recommended next steps

- [x] Confirm the API build and core backend flows are in place.
- [x] Confirm the auth/session and domain foundations are implemented.
- [x] Validate the project against the milestone checklist for auth, RBAC, import, notifications, FAQ, deletion, profile, and admin operations.
- [x] Add and verify rate limiting for public and sensitive endpoints.
- [x] Finalize deployment strategy and environment rollout steps.
- [x] Document and validate the database migration process.
- [x] Complete the incident response playbook and operational runbooks.
- [ ] Continue with mobile work only after the production-prep checks are closed.

This keeps the plan aligned with the milestone tracker: the core product backend is complete, and the remaining work is operational hardening before broader release readiness.

---

## 17. Mobile preview and device testing workflow

- [ ] Use Expo Go for QR-code-based live preview on real iPhone and Android devices
- [ ] Use Android emulator for Android validation and smaller-screen layouts
- [ ] Use Xcode iOS simulator for dynamic island / notch / safe-area checks
- [ ] Test on multiple physical widths: 320px, 360px, 390px, 414px and larger
- [ ] Verify text wrapping, scrolling, and button reachability on smaller phones
- [ ] Check status bar, tab bars, bottom safe areas, and keyboard overlap
- [ ] Validate both portrait and landscape behavior where needed
- [ ] Make UI QA a regular step before feature completion, not an afterthought
