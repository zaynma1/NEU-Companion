🔴 Critical Security Issues
1. Missing Database Table: allowed_email_domains
Problem: Database design includes this table, but requirements don't mention it
Risk: Domain enforcement cannot be implemented without this table
Impact: Unauthorized domains could access the system
2. Inconsistent Session Management
Problem: Requirements specify 14-day idle/30-day absolute timeouts, but no database constraints
Risk: Sessions could persist longer if application logic fails
Impact: Increased window for session hijacking
3. Weak Device Fingerprint Storage
Problem: device_fingerprint stored as plain text in sessions table
Risk: Fingerprints could be extracted and spoofed if database compromised
Impact: Device binding security compromised
4. Missing Rate Limiting Constraints
Problem: Requirements specify throttling rules (5 attempts/15min, 10 attempts/60min) but no database enforcement
Risk: Application-level rate limiting could be bypassed
Impact: Brute force attacks could succeed
5. Audit Log PII Exposure Risk
Problem: actor_label_snapshot could contain PII if not properly sanitized
Risk: Audit logs might contain personal information despite requirements
Impact: Privacy violation and compliance issues
🟡 Design Inconsistencies
6. Requirements vs Database Schema Mismatch - Deletion Tracking
Problem: Requirements mention users.deletion_requested_at, but database uses deletion_requests table
Impact: Confusion about deletion request tracking mechanism
7. Role Assignment Rules Missing from Requirements
Problem: Database includes role_assignment_rules table with domain pattern matching, but requirements don't detail this
Impact: Unclear how role inference actually works
8. Professor Teaching Claims Ambiguity
Problem: Requirements mention professors can "claim" course groups, but database uses professor_teaching_claims with both self-service and admin assignment
Impact: Unclear workflow for professor-group assignment
9. Missing Validation for Active Term
Problem: Requirements specify system_config.active_term as canonical value, but no database constraint ensures course terms match
Risk: Data inconsistency between course terms and active term
Impact: Enrollment and teaching claims could fail validation
10. Notification Idempotency Gap
Problem: Requirements specify idempotency keys for notifications, but database schema lacks unique constraint on idempotency_key
Risk: Duplicate notifications could be sent
Impact: User spam and resource waste
🟢 Data Integrity Issues
11. Missing Cascade Rules
Problem: Some foreign key relationships lack proper ON DELETE/UPDATE rules
Examples:
notifications.personal_event_id uses ON DELETE SET NULL but other relationships unclear
professor_teaching_claims doesn't specify cascade behavior
Risk: Orphaned records or data inconsistency
12. Weak Indexing Strategy
Problem: Missing indexes on frequently queried fields like users.email for authentication lookups
Impact: Performance degradation and potential race conditions
13. No Database-Level Encryption
Problem: Schema doesn't specify encryption for sensitive fields like contact_methods.value
Risk: Sensitive data exposed in database backups
Impact: Privacy violation if backups are compromised
🔵 Authorization Gaps
14. Missing Resource-Level Authorization
Problem: Requirements specify resource-action permission matrix, but database schema doesn't support row-level security
Risk: Authorization bypass possible if application logic fails
Impact: Unauthorized access to resources
15. Professor Profile Access Control
Problem: Requirements mention visibility levels (public, course_members_only, private) but no database enforcement
Risk: Profile information could be exposed to unauthorized users
Impact: Privacy violation
16. Office Hours Document Access
Problem: Database design mentions signed URLs for document access but no mechanism for access control at database level
Risk: Document URLs could be shared unauthorizedly
Impact: Unauthorized document access
🟠 Configuration & Deployment Issues
17. Missing System Config Validation
Problem: system_config table accepts any key-value pair without schema validation
Risk: Invalid configuration could break system functionality
Impact: System instability or security misconfiguration
18. No Database Migration Strategy
Problem: No mention of how schema changes will be managed
Risk: Deployment failures and data loss
Impact: Deployment risks and rollback difficulties
19. Missing Backup Requirements
Problem: Requirements mention 24-hour RPO and 8-hour RTO but no database backup strategy
Risk: Data loss and extended downtime
Impact: Business continuity risk