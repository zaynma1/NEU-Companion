# Monitoring and Alerting Runbook

## Purpose

This runbook defines the operational monitoring and alerting baseline for NEU Companion so the team can detect service degradation, abuse, import issues, and security-relevant events before they become outages or safety incidents.

The MVP requirements establish the following operational expectations:
- daily backups and recovery targets are defined
- repeated authentication abuse must trigger alerts
- failed import security scans must be visible to operators
- admin operators must be able to review security alerts and audit evidence
- monitoring must support service health, request errors, and security events with a clear escalation path

## Scope

This runbook covers:
- application health and dependency health
- authentication abuse monitoring
- import and dataset integrity signals
- administrator-facing alert review via the existing admin security and audit surfaces
- alert escalation paths and response ownership

This runbook does not define a full SaaS monitoring platform; instead it defines the required operational coverage for the MVP environment and the minimum alerting rules expected from the backend and infrastructure stack.

## Ownership

### Primary owners
- Engineering owner: owns service health and alert routing
- Backend owner: owns application-level errors and auth abuse monitoring
- Security/admin owner: owns alert triage and incident response workflow

### Response SLAs
- Critical security alert: acknowledge within 15 minutes
- Service health failure: acknowledge within 30 minutes
- Operational warning: acknowledge within 2 hours

## Monitoring sources

The monitoring baseline should collect signals from these sources:

1. Application metrics
   - request success/failure rate
   - latency by route and status code
   - auth success/failure rate
   - session validation failures
   - import job success/failure rate
   - database query latency and connection health

2. Dependency health
   - PostgreSQL availability and replication state
   - Redis availability where used for caches or background queues
   - external OAuth provider connectivity checks
   - file upload security scan status

3. Security signals
   - repeated failed auth attempts by client fingerprint or IP hash
   - blocked or suspicious sign-ins
   - challenge-required sign-ins
   - account-level abuse thresholds
   - admin action step-up verification failures

4. Operational signals
   - import batch validation failures
   - expired import batches
   - dataset version publication failures
   - unexpected configuration changes

## Required alert rules

### 1. Authentication abuse alerts

Trigger an alert when:
- the same client fingerprint or IP hash exceeds the configured failed-login threshold within the defined window
- the same account exceeds the failed-attempt threshold for retryable challenge enforcement
- a suspicious sign-in event matches the risk conditions defined in the security requirements

Required handling:
- emit a durable `security_alerts` event
- mark the issue as visible to admin operators
- include the related auth attempt reference when available
- route an immediate notification to the on-call owner if the event is critical or repeated

### 2. Import pipeline alerts

Trigger an alert when:
- a validation or publish step fails repeatedly
- a batch remains in `validating` beyond the configured timeout window
- a batch expires without being completed
- import security scanning fails before parsing or storage
- an applied dataset version cannot be validated for integrity

Required handling:
- create an operational incident ticket or on-call signal
- record the failure in admin-visible operational logs
- ensure the event is visible in the admin import and audit surfaces

### 3. Service health alerts

Trigger an alert when:
- API health check fails for more than one sampling period
- p95 latency crosses the target threshold for the API core endpoints
- the database or Redis dependency becomes unavailable
- the application fails to serve login, timetable, or import-critical endpoints

Required handling:
- surface a service-down or degraded-status warning
- trigger paging if the failure is user-impacting and sustained

### 4. Configuration drift alerts

Trigger an alert when:
- `system_config` is changed unexpectedly
- supported config values are missing or invalid at boot
- required admin config values such as `active_term` or `campus_timezone` are not present

Required handling:
- audit the change
- validate the config against expected startup conditions
- route to the admin/engineering owner if the config affects access or term behavior

## Health checks

The service must expose minimal health endpoints sufficient for automated monitoring.

Minimum health checks:
- liveness endpoint: confirms the process is alive
- readiness endpoint: confirms required dependencies are reachable and able to serve traffic
- dependency health: API, DB, and Redis status

The health endpoint should return a simple status payload such as:
- `ok` or `degraded`
- dependency state per external service
- a timestamp for the last successful self-check

## Structured logging

All production logs should be structured and include:
- timestamp in UTC
- service name
- environment name
- request correlation ID
- user id or request actor only when safe and necessary
- route or action type
- result outcome and error class

The logging policy should avoid storing raw secrets or sensitive PII in logs. For authentication events, log only the non-PII operational identifiers and the outcome classification.

## Admin visibility and alert review

Admin operators must be able to review:
- audit log entries
- security alerts
- recent import lifecycle events
- current system configuration values

This is the operational bridge between system signals and the admin controls defined under Domain 9. Any alert with a security or access impact must remain available through the admin audit/security surface and should be acknowledged by an authorized operator.

## Alert routing and escalation

### Severity mapping

- Critical: repeated auth abuse, major dependency outage, import security failure, unauthorized configuration drift
- Warning: elevated latency, failed retries, unusual but non-blocking auth threshold conditions
- Info: successful recovery, completed warning resolution, low-risk operational notices

### Route to

- engineer on call for service health degradation
- backend owner for auth and import events
- admin owner for security alert review and system config issues

## Operational dashboards

The MVP dashboard should include at minimum:
- request success/error rate by route
- p95 latency by route
- auth attempts by outcome and source
- active security alerts
- import batch outcomes by status
- database and Redis availability
- recent system config changes

## Incident runbook integration

Any monitoring event that indicates a likely security or service-impacting incident must be linked into the incident playbook and should include:
- event time
- affected route or service
- relevant auth or import identifiers
- known impact
- current owner and status
- recovery actions taken

## Required verification checks

Before declaring monitoring active, confirm the following:

- [ ] The service exposes liveness and readiness checks
- [ ] The application emits structured logs for critical events
- [ ] Security alerts are created for auth abuse conditions
- [ ] Import failures and validation timeouts are visible in admin-observable logs
- [ ] Admins can review security alerts and audit log entries
- [ ] Alert severity routing is defined and assigned
- [ ] Degraded or failed dependencies produce an alert path
- [ ] The team has a documented escalation path for critical incidents

## Related requirements and design inputs

This runbook is grounded in:
- [docs/requirements.md](requirements.md): security abuse thresholds, security alerting, incident response path, and admin review of security events
- [docs/api-design/api-domains.md](api-domains.md): Domain 9 admin operations and operational control responsibilities
- [docs/api-design/domain-09-admin-operations-system-controls.md](api-design/domain-09-admin-operations-system-controls.md): security alert listing and acknowledgement flows
- [docs/database-design.md](database-design.md): `security_alerts`, `audit_log_entries`, `auth_attempts`, `system_config`, and import lifecycle tables

## Notes

The system already includes some operational support in the app layer, including admin security alert and audit log endpoints, but the full production readiness policy still requires a live monitoring stack, health checks, explicit alert rules, and a clear operator escalation procedure.
