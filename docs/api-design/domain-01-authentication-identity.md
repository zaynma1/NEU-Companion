# API Design: Authentication & Identity

This is the first complete API design for the project. It is scoped to Domain 1 only and follows the requirements as the behavioral source of truth and the schema as the persistence source of truth.

## Domain scope

This domain covers:
- Google OAuth login and allowed-domain enforcement
- user onboarding shell creation
- role inference and pending-role handling
- session creation, refresh, and logout
- account switching re-auth flow
- security event tracking for failed or suspicious sign-in attempts

This domain does not cover:
- course or timetable operations
- admin import/rollback
- admin pending-review, role correction, or verification grant/revoke
- announcement or notification workflows
- FAQ, profile, or deletion flows (those are separate domains)

## Actors

- Guest
- Student
- Professor
- Admin
- Pending user

## Core principles

1. Identity is anchored to Google subject ID, not email string; verified Google ID-token `given_name` and `family_name` claims supply the first and last name when available.
2. Access is denied for disallowed domains before a session is created.
3. Any role uncertainty lands in pending state until reviewed.
4. A session is only valid if the user record is still active and not blocked/suspended.
5. Session data is stored as a hash of the bearer token; the raw token is never persisted.
6. Auth-related security events are recorded as immutable audit/security evidence.
7. Admin review and role correction are handled under Domain 9: Admin Operations & System Controls.

## Resource model

### User account
A user is the principal identity and record used across the whole platform.

Key properties:
- id
- google_subject_id
- email
- full_name
- username
- student_or_staff_id
- department
- role
- account_status
- onboarding_completed_at
- created_at

### Session
A valid authenticated session bound to a user and device fingerprint.

Key properties:
- id
- user_id
- token_hash
- created_at
- last_active_at
- idle_expires_at
- absolute_expires_at
- step_up_verified_at
- device_fingerprint
- ip_country
- revoked_at
- revoked_reason

### Auth attempt
A security and risk record for sign-in attempts.

Key properties:
- client_fingerprint
- account_user_id
- outcome
- ip_country
- occurred_at

## Public API surface

### 1. Begin Google login

POST /api/v1/auth/google/start

Purpose:
- initiate OAuth flow for a user with the configured provider and state/nonce values

Request:
- no body required
- optional redirect target or client context

Response:
- 302 redirect to Google provider, or a structured response for non-browser clients

Notes:
- must generate and store OAuth state and nonce values in a server-controlled secure flow
- must reject unsafe or mismatched request contexts
- redirect targets must resolve to a registered allow-listed URI or internal route identifier; arbitrary external URLs are rejected

### 2. Complete Google login

POST /api/v1/auth/google/callback

Purpose:
- complete OAuth exchange and establish or reject user identity

Request:
- code
- state
- nonce
- redirect context optional
- device context is derived server-side from a protected device cookie and request metadata; clients do not submit an authoritative fingerprint

Response:
- success: authenticated session cookie and user context
- deny: rejection result with reason and request-access path when domain is not allowed
- pending: authenticated limited session if role is pending and onboarding is incomplete
- challenge_required: risk challenge is required before a normal authenticated session is created

Success conditions:
- Google subject matches an existing user or creates a shell row
- domain is allowed
- account status is active
- role is resolved or pending

Session device binding:
- the server creates or retrieves a device binding during OAuth callback and stores its non-PII fingerprint in `sessions.device_fingerprint`
- the same binding is used for client-scoped throttling and first-device risk checks

Failure conditions:
- disallowed domain
- account blocked or suspended
- state/nonce mismatch
- challenge failure

Risk flow:
- when a new-device or suspicious-sign-in risk threshold is reached, the callback returns `challenge_required` with a challenge reference and does not create a normal authenticated session
- after successful challenge verification, the server establishes the authenticated session and records the result

### 3. Get current auth session

GET /api/v1/auth/session

Purpose:
- return the current authenticated user and session state

Response:
- user id, role, account status, onboarding state
- session expiry information
- whether step-up is required

Security rules:
- must validate that session is not revoked, expired, or stale
- must read current role and account status live from the user record

### 4. Log out current session

POST /api/v1/auth/logout

Purpose:
- invalidate the active session and remove the client’s ability to continue using the bearer token

Request:
- current session context

Response:
- success confirmation

Side effects:
- revoke session
- clear cookies or token state
- record security or audit event if policy requires it

### 5. Log out all sessions

POST /api/v1/auth/logout-all

Purpose:
- revoke every active session for the authenticated user

Security rules:
- only the current user may do this for their own account

### 6. List active sessions

GET /api/v1/auth/sessions

Purpose:
- list active sessions owned by the current user, including device and last-active metadata

Response:
- session id
- device fingerprint or device label
- created_at
- last_active_at
- idle_expires_at
- current session indicator

Authorization:
- current user may list only their own sessions

### 7. Revoke a specific session

POST /api/v1/auth/sessions/{sessionId}/revoke

Purpose:
- revoke a single session to log out a specific device

Behavior:
- set revoked_at and revoked_reason for the target session
- invalidate access for that device immediately
- do not affect other active sessions for the user

Authorization:
- current user may revoke only their own sessions

### 8. Start a step-up challenge

POST /api/v1/auth/challenge

Purpose:
- issue a fresh verification challenge when risk or privileged action requires it

Request body:
- challenge_type: step_up | google_reauth | suspicious_login
- target_action optional

Response:
- challenge_id
- challenge_secret
- challenge_type
- issued_at
- expires_at

Behavior:
- creates an auth_attempt record with outcome `challenge_issued`
- binds the challenge to the initiating OAuth auth attempt, or to the authenticated session, account, device fingerprint, and target action
- challenge must be completed before privileged action proceeds

### 9. Complete a step-up challenge

POST /api/v1/auth/challenge/verify

Purpose:
- verify the challenge response and refresh the session’s step-up freshness window

Request body:
- challenge_id
- challenge_secret
- response

Validation:
- challenge must exist and still be active
- challenge must match the initiating OAuth flow or current session, account, device fingerprint, and intended purpose
- the server compares the supplied secret with the stored hash and never stores the raw secret
- response must match the challenge policy
- expired or consumed challenges are rejected; failed attempts are incremented atomically and the challenge is invalidated after five failures
- if the challenge fails, record outcome `challenge_failed` and deny the action

Response:
- verified: true | false
- step_up_verified_at if success

### 10. Switch account

POST /api/v1/auth/switch-account

Purpose:
- move the current client from one Google identity to another

Flow:
- start Google re-auth for a different account
- prove the new identity with OAuth
- terminate previous session
- establish new authenticated context

Rules:
- this is not direct password-based account switching
- previous active session must end once the new identity is accepted
- if a previous session is still active, it is invalidated as part of the flow

### 11. Get onboarding status

GET /api/v1/auth/onboarding

Purpose:
- determine whether the current user still needs required onboarding fields

Response:
- onboarding complete / incomplete
- missing required fields

### 12. Complete onboarding

POST /api/v1/auth/onboarding

Purpose:
- allow the user to confirm or supply required first-login data: full name, student/staff ID, department

Request:
- full_name only when verified Google name claims are missing or unusable
- student_or_staff_id only when the email local part does not yield a valid approved identifier
- department

Validation:
- required fields must be present
- the Google ID token must be signature, issuer, audience, and nonce validated before its identity claims are used
- the application requests only the `openid`, `email`, and `profile` scopes needed for identity and onboarding and shows the applicable consent/privacy notice
- the student/staff identifier is derived from the email local part before `@` only when the verified email domain is `@std.neu.edu.tr` (students: local part is student ID) or `@neu.edu.tr` (staff: local part format is firstname.lastname)
- user-supplied fallback name or identifier values must be confirmed before persistence
- data can be saved only before onboarding completion is marked
- values must conform to business validation rules

Response:
- updated onboarding status
- current role status after processing

## Validation and behavioral rules

### Allowed-domain policy
- access is denied if Google email domain is not allowed
- the user must receive a clear rejection reason and access request path
- domain policy is configurable and may include or exclude subdomains

### Role inference rules
- if role can be inferred safely, assign it automatically
- if not, assign pending and restrict UI to onboarding and minimal access
- role inference is based on configured rules and domain patterns

### Account status rules
- active users create valid sessions
- suspended and blocked users cannot create active sessions
- account status is checked at login and on every session validation path

### Session validation rules
- session must not be revoked
- session must not be expired by idle/absolute expiry
- privileged step-up freshness is enforced when required
- current role/account status must be read live from the user table

### Security challenge rules
- OAuth state and nonce validation is mandatory
- sign-in is throttled for 15 minutes after 5 failed attempts from the same client IP or device fingerprint within 15 minutes
- challenge verification is bound to its OAuth attempt or current session, account, device fingerprint, and intended purpose; the first success consumes it atomically
- a challenge is invalidated after 5 failed verifications, and challenge issuance is rate-limited per account and device
- suspicious sign-ins generate security alerts

### Cookie request protection
- every cookie-authenticated state-changing endpoint requires a server-issued CSRF token and validates the request `Origin` against configured application origins
- OAuth callback state and nonce checks remain mandatory; SameSite cookies are defense in depth, not the sole CSRF control
- account abuse threshold can produce alerting events
- after 10 failed attempts associated with the same account within 60 minutes, require challenge verification only for the affected client IP or device fingerprint; attempts from unrelated clients must not be blocked by that threshold
- apply client IP and device-fingerprint throttles with bounded expiry so an attacker cannot create an account-wide lockout
- privileged mutations require fresh step-up verification within the configured 10-minute interval

## Response model conventions

### Success response envelope
- status: success
- data: resource or action payload
- meta: request metadata if relevant

### Error response envelope
- status: error
- code: machine-readable code
- message: human-readable summary
- details: per-field or per-operation detail when needed

Example error codes:
- auth.domain_rejected
- auth.state_invalid
- auth.account_blocked
- auth.session_expired
- auth.step_up_required
- validation.required_field_missing

## Persistence contract mapping

This domain reads and writes the following persistence surfaces:
- users
- sessions
- auth_attempts
- challenges
- security_alerts

This domain reads the following configuration tables (managed by admin and deployment):
- allowed_email_domains
- role_assignment_rules

It must emit audit entries for:
- login success/failure
- suspicious authentication failures and challenge outcomes
- security incidents

Role review, role correction, and admin management of allowed domains and role rules are intentionally not part of this domain and are handled by Domain 9 and deployment processes.

## Non-functional constraints

- OAuth state and nonce values must be unique and non-reusable.
- token hashes must use a secure HMAC strategy and never store raw bearer tokens.
- all session expiry checks must be time-based and server-side enforced.
- failed authentication events must be logged with fingerprint and country metadata when available.
- role and account status decisions must be re-evaluated at validation time, not only at login time.
