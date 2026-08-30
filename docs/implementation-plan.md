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
- [ ] Add CI validation for build/lint/test on PRs

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

- [ ] Create local `.env` from `.env.example`
- [ ] Start PostgreSQL and Redis via Docker Compose
- [ ] Verify database connectivity from the API
- [ ] Add application configuration module (`ConfigModule`)
- [ ] Add structured logging and request correlation
- [ ] Add healthcheck endpoints
- [ ] Add shared validation / error handling conventions

---

## 3. Database schema and migrations

- [ ] Define PostgreSQL schema baseline for auth/users
- [ ] Create initial migration for `users`
- [ ] Create initial migration for `sessions`
- [ ] Create initial migration for `auth_attempts`
- [ ] Create initial migration for `challenges`
- [ ] Create initial migration for `allowed_email_domains`
- [ ] Create initial migration for `role_assignment_rules`
- [ ] Create initial migration for `audit_logs`
- [ ] Add indexing strategy for lookup-heavy queries
- [ ] Add DB seed rules for admin/system config defaults

---

## 4. Auth and identity domain (Domain 1)

- [ ] Set up TypeORM / Prisma / repository layer for Postgres
- [ ] Define user entity and auth-related entities
- [x] Implement Google OAuth login route
- [x] Implement allowed-domain enforcement
- [x] Add local-development Google fallback route for env-less testing
- [ ] Implement identity parsing for student/staff status
- [ ] Implement challenge generation and verification flow
- [ ] Implement secure session creation with cookie + hash storage
- [ ] Add session validation middleware / guard
- [ ] Add logout and session revocation flow
- [ ] Add step-up verification handling for sensitive actions
- [ ] Add admin-config read flow for policy tables

---

## 5. Authorization and role model

- [ ] Define RBAC / claims model for users
- [ ] Implement role assignment logic from config rules
- [ ] Add admin override paths
- [ ] Add role-based guard infrastructure
- [ ] Add permission checks for student / professor / admin flows
- [ ] Add audit logging for role changes and policy updates

---

## 6. Course and enrollment domain (Domain 2)

- [ ] Create course catalog entities
- [ ] Create term / program entities
- [ ] Create enrollment entities
- [ ] Implement professor teaching self-claim workflow
- [ ] Implement admin verification / approval workflow
- [ ] Implement active-term enforcement
- [ ] Add enrollment rules and status transitions
- [ ] Add professor/course relationship checks

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

- [ ] Create FAQ question / answer entities
- [ ] Add vote tracking and moderation state
- [ ] Add moderation queue and approval flow
- [ ] Add user question submission rules
- [ ] Add answer acceptance logic

---

## 11. Profile, contact, and office hours (Domain 7)

- [ ] Create profile entities
- [ ] Create contact information model
- [ ] Create office-hours schedule model
- [ ] Add visibility rules for public/private profile data
- [ ] Add signed URL or secure access flow for protected profile assets
- [ ] Add profile edit and verification workflow

---

## 12. Account lifecycle and deletion (Domain 8)

- [ ] Define deletion request and processing state model
- [ ] Add anonymization workflow
- [ ] Add account deactivation / suspension state transitions
- [ ] Add personal event exception handling integration for deletion
- [ ] Add retention and audit logging rules
- [ ] Implement consumer-facing deletion confirmation flow

---

## 13. Admin operations and system controls (Domain 9)

- [ ] Define admin configuration entities
- [ ] Implement allowed-email-domain management API
- [ ] Implement role assignment configuration API
- [ ] Add audit log viewer and filtering
- [ ] Add system alerts and status dashboards
- [ ] Add role correction / verification tooling
- [ ] Add platform control endpoints for operational actions

---

## 14. Security and operational hardening

- [ ] Add rate limiting
- [ ] Add CSRF / cookie security hardening
- [ ] Add secure session rotation strategy
- [ ] Add challenge replay protection
- [ ] Add secret management via environment variables
- [ ] Add request validation and sanitization
- [ ] Add observability / metrics
- [ ] Add error tracking and health monitoring

---

## 15. Testing and release readiness

- [ ] Add unit tests for auth/session logic
- [ ] Add integration tests for DB access and auth flows
- [ ] Add E2E tests for key user journeys
- [ ] Add API contract validation
- [ ] Add mobile UI regression checks for iOS and Android
- [ ] Add device preview checklist for small phone sizes, notch/Dynamic Island handling, and safe-area layout
- [ ] Add smoke tests for Docker + Postgres + Redis startup
- [ ] Add deployment configuration for staging/prod
- [ ] Add release checklist and rollback procedure

---

## 16. Immediate next milestone

The next concrete milestone is:

1. Configure PostgreSQL + Redis locally

## Recommended next steps

This is the exact action list we are following next and it remains aligned with the current implementation plan.

- [x] Verify the app boots on the configured port and the API responds on the health/session route.
- [x] Confirm Docker Compose is running PostgreSQL and Redis locally.
- [x] Validate the auth routes and local OAuth fallback for containerless development.
- [ ] Finalize the exact Google OAuth client redirect URI in the environment and in Google Cloud.
- [ ] Complete a live Google OAuth sign-in through the real callback route.
- [ ] Confirm the callback creates or reuses the user and creates a secure session cookie.
- [ ] Add a real callback integration test to codify the live provider flow.
- [ ] Move to permissions and admin controls only after the Google flow is proven end-to-end.
- [ ] Continue with the next domain slice after the identity foundation is locked.

This stays in the same plan lane as the milestone tracker: the auth foundation is complete, and the next step is real provider verification before expanding into permissions and the rest of the domain backlog.
2. Add database connection layer and initial schema migrations
3. Build the auth/session module
4. Create first protected routes and allowed-domain checks
5. Validate login and session lifecycle end-to-end
6. Scaffold the mobile app with Expo + React Native
7. Set up live preview on physical device and emulator for iOS + Android
8. Verify safe-area, phone-size, and touch behavior during early UI work

This is the minimum viable foundation before moving into course, schedule, and admin flows.

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
