# Frontend Milestones

We are following the backend handoff and tracking the mobile frontend against the real implementation state. The app should not begin until the backend readiness gates are confirmed.

## Milestone 0 — Backend handoff gate
Status: Complete

- [x] Backend API build is green
- [x] Auth/session hardening is implemented
- [x] Google OAuth is validated in the live flow
- [x] Deployment and environment hardening is in place
- [x] API contract stability is verified
- [x] Frontend integration contract is ready for app work

Deliverables:
- stable backend API contract
- secure session cookie behavior
- operating config for local and production readiness
- app handoff checklist for mobile integration

## Milestone 1 — Frontend foundation and app bootstrap
Status: Not started

- [ ] Decide on the mobile stack and app architecture (React Native + Expo)
- [ ] Create a dedicated mobile app workspace under the monorepo
- [ ] Set up the app package, TypeScript, and Expo tooling
- [ ] Add app config and environment management for local/dev/staging
- [ ] Add base app shell with safe-area and app theme scaffolding
- [ ] Add navigation shell and root layout
- [ ] Add API client layer and base request configuration
- [ ] Add auth session bootstrap and redirect handling
- [ ] Add local preview flow for simulator and physical device

Deliverables:
- working app scaffold
- base navigation structure
- typed API client layer
- environment-aware auth bootstrap

## Milestone 2 — Authentication and onboarding flow
Status: Not started

- [ ] Build login entry screen and Google sign-in flow
- [ ] Add session restore on app launch
- [ ] Add guest / authenticated routing logic
- [ ] Add logout and session expiry handling
- [ ] Add pending-user onboarding screens
- [ ] Add role-aware first-run experience
- [ ] Add loading, error, and retry states for auth flows
- [ ] Add secure handling of cookies/session state for web-to-app bridging

Deliverables:
- working sign-in flow
- authenticated shell
- onboarding state handling

## Milestone 3 — Student and professor core screens
Status: Not started

- [ ] Build home dashboard and top-level navigation
- [ ] Build profile and contact screen flow
- [ ] Build course listing and enrollment screens
- [ ] Build timetable / schedule screens
- [ ] Build personal events and reminders flow
- [ ] Build notifications and announcements feed
- [ ] Build FAQ and moderation browsing flow
- [ ] Add role-aware permissions for student / professor / admin screens

Deliverables:
- primary user-facing app screens
- role-aware app navigation
- student and professor flows reach MVP status

## Milestone 4 — Admin and operational screens
Status: Not started

- [ ] Build admin dashboard and control panel shell
- [ ] Build domain configuration screens for allowed domains and system config
- [ ] Build review and audit log surfaces for admin use
- [ ] Build import monitoring / status screens
- [ ] Build security alert and account review surfaces
- [ ] Add permission guards for admin-only screens

Deliverables:
- admin surfaces for staff operations
- visibility into core platform controls

## Milestone 5 — Device quality, UX polish, and release readiness
Status: Not started

- [ ] Add phone-first layouts for small-screen widths
- [ ] Add safe-area handling for iPhone and Android devices
- [ ] Add dark mode and light mode theme tokens
- [ ] Add touch-target sizing and accessibility spacing
- [ ] Add responsive rules for common device sizes
- [ ] Validate keyboard overlap, tab bar, and bottom safe-area behavior
- [ ] Validate portrait and landscape modes where needed
- [ ] Add visual QA checklist for iOS and Android parity
- [ ] Add app-level smoke tests for the main sign-in and dashboard flows
- [ ] Add release checklist and rollback plan for the mobile app

Deliverables:
- device-ready UX
- QA checklist for release
- frontend release confidence before production launch

## Recommended next steps

- [x] Confirm the backend is ready for frontend integration.
- [ ] Create the mobile workspace and app bootstrap.
- [ ] Implement the auth and session flow in the app.
- [ ] Build the primary student/professor screens.
- [ ] Validate device-level UX before expanded feature work.
- [ ] Only then expand to advanced admin flows and polish.
