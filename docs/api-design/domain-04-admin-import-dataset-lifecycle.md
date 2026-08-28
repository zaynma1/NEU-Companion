# API Design: Admin Import & Dataset Lifecycle

This is the fourth complete API design in the series. It is scoped to Domain 4 only and follows the requirements as the behavioral source of truth and the schema as the persistence source of truth.

## Domain scope

This domain covers:
- Excel upload workflow for official timetable data
- template validation and row-level rejection handling
- import batch lifecycle
- publish/apply atomic dataset swap
- rollback to any prior successful version
- admin operational visibility into import results and history

This domain does not cover:
- student timetable UI or personal scheduling
- reminder or notification dispatching
- course enrollment operations
- FAQ or profile management

## Actors

- Admin
- Student
- Professor

## Core principles

1. Only admins can upload, apply, or rollback imports.
2. Import validation runs before any dataset publication.
3. Official timetable data is published as an immutable dataset version and never mutated in place.
4. Apply/rollback uses atomic dataset swap semantics so readers never see mixed data.
5. Duplicate rows in a single file are rejected as validation failures.
6. The current-term dataset is tracked with a single current flag per term.
7. Rollback creates a new audit-logged publication event without deleting prior versions.

## Resource model

### ImportBatch
Represents a file upload and validation/apply cycle.

Key properties:
- id
- term
- uploaded_by
- file_name
- template_version
- content_hash
- status
- row_count
- created_at
- applied_at

### ImportRowError
Row-level validation issue in an import batch.

Key properties:
- id
- import_batch_id
- row_number
- field_name
- error_reason

### DatasetVersion
A published immutable timetable dataset version.

Key properties:
- id
- term
- import_batch_id
- previous_version_id
- is_current
- published_at

### OfficialEvent
The published timetable record resulting from the data import.

Key properties:
- id
- dataset_version_id
- course_group_id
- event_type
- start_datetime
- end_datetime
- location

## Public API surface

### 1. Upload import file

POST /api/v1/admin/imports

Purpose:
- accept a timetable Excel file for validation and future publication

Request:
- file
- term
- template_version
- optional notes

Validation before acceptance:
- admin-only access
- file extension and MIME validation
- file size below configured maximum
- row count below configured maximum
- filename allowed by whitelist
- malware scan completed successfully

Response:
- import_batch_id
- status: validating
- accepted row count or preview metadata if available

### 2. Get import status

GET /api/v1/admin/imports/{batchId}

Purpose:
- view the lifecycle state of a specific import batch

Response:
- status
- term
- file name
- content hash
- row count
- validation summary
- applied_at if applicable

Authorization:
- admin only

### 3. List import batches

GET /api/v1/admin/imports

Purpose:
- browse historical import attempts, including failed, rejected, validated, and applied batches

Query parameters:
- term optional
- status optional
- uploaded_by optional
- from, to optional
- limit required, integer 1..100
- cursor optional

Response:
- paginated import-batch summaries
- batch id, term, status, file name, content hash, row count, and timestamps

Authorization:
- admin only

### 4. Get import validation errors

GET /api/v1/admin/imports/{batchId}/errors

Purpose:
- return the row-level validation problems associated with an import batch

Response:
- list of row_number, field_name, error_reason

Query parameters:
- limit required, integer 1..500
- cursor optional

Authorization:
- admin only

### 5. Preview import diff

GET /api/v1/admin/imports/{batchId}/diff

Purpose:
- show the proposed effect of the import before final publish

Response:
- add_count
- update_count
- remove_count
- summary by course group or term
- list of affected events if needed

Query parameters for affected events:
- limit required, integer 1..500
- cursor optional

Authorization:
- admin only

### 6. Apply import

POST /api/v1/admin/imports/{batchId}/apply

Purpose:
- publish the validated import as the current dataset version for the selected term

Request body:
- destructive_change_confirmation optional when removals are large

Validation:
- import must be in validated state
- batch must contain no unresolved validation errors
- content hash must match uploaded file
- term must be explicit and isolated to the target term
- if destructive changes exceed threshold, require explicit confirmation
- require a fresh step-up verification within the last 10 minutes before a publish or rollback action proceeds

Behavior:
- create a new dataset version
- atomically make it the current version for that term
- preserve previous versions as immutable history
- record audit event and publication metadata
- if the same `content_hash` was already applied for the same term and results in no effective dataset change, return the existing current dataset version without creating a duplicate published version

Response:
- dataset_version_id
- new current state
- publication timestamp

### 7. Rollback import

POST /api/v1/admin/imports/rollback

Purpose:
- restore a prior dataset version for the selected term

Request body:
- term
- dataset_version_id

Validation:
- must target a prior successful version for the same term
- admin-only access
- rollback is a new publication event and not a deletion of history
- the current session must have fresh step-up verification within 10 minutes before rollback proceeds

Behavior:
- create a new dataset version representing the restored state
- atomically swap current flag for the term
- preserve old version history
- add audit log event

Response:
- new dataset_version_id
- restored term state

### 8. List dataset versions

GET /api/v1/admin/terms/{term}/dataset-versions

Purpose:
- show historical published versions for a term

Response:
- list of dataset versions with timestamps, publication source, current flag, and version id

Query parameters:
- limit required, integer 1..100
- cursor optional

Authorization:
- admin only

### 9. Get current dataset for a term

GET /api/v1/admin/terms/{term}/current-dataset

Purpose:
- fetch the currently published dataset state for inspection or operational reporting

Response:
- current dataset version id
- publication timestamp
- count of events or summary metadata

Authorization:
- admin only

### 10. Retry failed import

POST /api/v1/admin/imports/{batchId}/retry

Purpose:
- re-run a failed import batch after correcting the underlying issue

Request body:
- optional notes
- optional file replacement when a new file is required

Validation:
- import batch must be in a retryable failed state
- only admin can trigger retries
- a fresh validation pass is required before re-apply
- step-up freshness is enforced for retry attempts that can publish or alter dataset state
- retry keeps the batch status as `failed` until a new validation attempt changes it to `validating`

Behavior:
- resets a retryable batch to `validating`
- rechecks template and row validity
- preserves original import metadata unless a new file is explicitly uploaded

Expiration:
- a batch in `validating` becomes `expired` when it remains incomplete beyond the configured validation timeout or retention window
- the expiration job records `expired_at` when it changes the status
- `validated`, `applied`, `rolled_back`, and `failed` batches are not changed to `expired`

Response:
- batch_id
- updated status
- validation summary

## Persistence contract mapping

This domain reads and writes the following persistence surfaces:
- import_batches
- import_row_errors
- dataset_versions
- official_events

It must emit audit entries for:
- upload acceptance and rejection
- validation failures
- publish and rollback events
- destructive-change confirmations
- security-relevant import failures and destructive-change decisions

## Non-functional constraints

- apply and rollback operations must be atomic at the dataset-version layer
- import validation must be deterministic and idempotent for the same uploaded content
- failed retries must not silently re-use stale content hashes or outdated validation summaries
- feature-level step-up freshness is required before apply, rollback, and any high-risk import action
