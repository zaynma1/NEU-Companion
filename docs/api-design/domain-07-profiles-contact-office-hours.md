# API Design: Profiles, Contact & Office Hours

This is the seventh complete API design in the series. It is scoped to Domain 7 only and follows the requirements as the behavioral source of truth and the schema as the persistence source of truth.

## Domain scope

This domain covers:
- user profile shell data and profile editing
- contact-method preferences and visibility rules
- profile read access based on role and visibility settings
- global professor directory search
- verification-status display for professor and admin profiles
- professor office-hours document upload and retrieval

This domain does not cover:
- authentication/session flows
- enrollment or timetable rendering
- import lifecycle or dataset publication
- admin pending-review or role-correction operations
- verification grant/revoke mutations; these belong to Domain 9

## Actors

- Student
- Professor
- Admin

## Core principles

1. Profile content is user-owned, but visibility is enforced at read time.
2. Verification is system-managed and cannot be self-assigned.
3. Contact methods remain a user-controlled set, with only one preferred method at a time.
4. Office-hours documents are authoritative and one current document per professor.
5. Visibility defaults do not expose sensitive fields to unauthorized viewers.
6. Display and access rules are applied using the configured campus timezone.

## Resource model

### Profile
The user profile record contains identity and profile metadata.

Key properties:
- user_id
- photo_url
- verification_status
- created_at

### ContactMethod
A user-provided contact method entry.

Key properties:
- id
- user_id
- method_type
- value
- is_preferred
- created_at

### VisibilitySetting
A visibility override for a specific profile field.

Key properties:
- user_id
- field_name
- visibility_level

### ProfessorScheduleDocument
The authoritative office-hours document for a professor.

Key properties:
- id
- professor_id
- file_url
- mime_type
- file_size_bytes
- uploaded_at
- office_hours_summary

## Public API surface

### 1. Get current profile

GET /api/v1/profile

Purpose:
- fetch the authenticated user’s own profile and visibility metadata

Response:
- basic profile fields
- photo_url
- username
- contact methods
- verification status
- visibility settings

Authorization:
- authenticated user only

### 2. Update profile

PUT /api/v1/profile

Purpose:
- update user profile fields such as username, photo, and contact preferences

Request body:
- username optional
- preferred_contact_method optional

Validation:
- username must be unique when present
- only the current user may update their own profile

### 3. Upload profile photo

POST /api/v1/profile/photo

Purpose:
- upload and validate a profile image, then associate the server-managed asset with the current profile

Request:
- image file payload

Validation:
- supported image MIME and extension
- configured size limit
- malware/content scan must pass before persistence
- external URLs are not accepted as photo assets

Response:
- validated photo_url
- updated_at

### 4. Get visibility settings

GET /api/v1/profile/visibility

Purpose:
- fetch effective visibility settings for the current user

Authorization:
- current user only

### 5. Update visibility settings

PUT /api/v1/profile/visibility

Purpose:
- update visibility for specific fields such as real_name, username, email, and contact_method

Request body:
- field_name
- visibility_level

Validation:
- field_name must be a supported field
- caller must be the owner of the profile

### 6. List contact methods

GET /api/v1/profile/contact-methods

Purpose:
- list user-owned contact methods and preferred contact settings

Authorization:
- current user only

### 7. Add contact method

POST /api/v1/profile/contact-methods

Purpose:
- add a new contact method for the authenticated user

Request body:
- method_type
- value
- is_preferred optional

Validation:
- method_type must be one of email, phone, office_location, other
- the authenticated user is the owner of the new contact method
- if is_preferred is set, it becomes the preferred method and other preferred rows are cleared

### 8. Update contact method

PUT /api/v1/profile/contact-methods/{contactMethodId}

Purpose:
- update an existing contact method

Authorization:
- current user only; `contactMethodId` must belong to the authenticated user, otherwise return not found

### 9. Delete contact method

DELETE /api/v1/profile/contact-methods/{contactMethodId}

Purpose:
- remove a user-owned contact method

Authorization:
- current user only; `contactMethodId` must belong to the authenticated user, otherwise return not found

### 10. Get public professor profile

GET /api/v1/professors/{userId}/profile

Purpose:
- retrieve a professor profile with visibility-limited fields

Response:
- fields allowed by profile visibility rules
- office-hours document metadata when available
- verification badge when active

Authorization:
- any authenticated user may view allowed professor profile data

### 11. Search professor directory

GET /api/v1/professors

Purpose:
- search the global professor directory to discover professor profiles and office-hours documents

Query parameters:
- q optional
- department optional
- limit required, integer 1..100
- cursor optional

Response:
- paginated professor summaries
- professor id, visible profile fields, verification badge state

Authorization:
- authenticated users may search visible professor directory entries

### 12. Get professor office-hours document

GET /api/v1/professors/{userId}/office-hours

Purpose:
- fetch the current office-hours document for a professor

Response:
- file_url
- mime_type
- uploaded_at
- office_hours_summary
- last_updated timestamp if available

Authorization:
- the document URL is returned when the caller is permitted to view the professor's profile
- documents are stored privately and the URL is short-lived and signed; authorization is rechecked at download time

### 13. Upsert professor office-hours document

PUT /api/v1/professors/{userId}/office-hours

Purpose:
- create or replace the professor’s authoritative office-hours document while retaining the one-current-document rule

Request:
- file payload
- optional summary text

Validation:
- caller must be the professor or an authorized admin
- supported formats only: PDF, PNG, JPEG, DOC, DOCX, Excel
- malware scan and size validation must pass before storage
- file metadata must be validated before persisting the URL

Response:
- document metadata
- uploaded_at
- file_url

### 14. Delete professor office-hours document

DELETE /api/v1/professors/{userId}/office-hours

Purpose:
- remove the current office-hours document without replacing it

Validation:
- caller must be the professor or an authorized admin
- delete is permitted only when a replacement is not simultaneously being uploaded
- the document record is cleared while preserving any historical audit trail

Response:
- success confirmation

## Validation and behavioral rules

### Visibility rules
- `visibility_settings` enforces default visibility for identity and contact fields
- missing rows fall back to application defaults
- hidden fields are not exposed in public profile payloads to unauthorized parties
- `public` fields may be returned to authenticated directory viewers; `course_members_only` fields require an active enrollment in a course group taught by the professor; `private` fields are returned only to the profile owner and authorized admin actions
- directory search returns only professor records with at least one viewable public field and never exposes course-member-only or private fields to non-members
- contact methods are filtered to the current user’s allowed visibility scope

### Verification rules
- verification status is managed by system or admin flow
- it is not self-assignable
- verified badge is surfaced only when verification_status is `verified`

### Document rules
- each professor has only one current office-hours document
- a valid upload replaces the previous document and updates the last-updated metadata
- a delete request may clear the current document only when the professor intentionally removes it or an admin authorized action is taken
- the authoritative office-hours document is used as the source of truth for display
- office-hours summary is shown with the configured campus timezone

### Contact method rules
- a user may have multiple contact methods of different types
- at most one preferred method is allowed
- removing the preferred method requires setting a new preferred method or leaving none set

## Response model conventions

### Success response envelope
- status: success
- data: resource payload
- meta: request metadata if relevant

### Error response envelope
- status: error
- code: machine-readable code
- message: human-readable summary
- details: field or flow detail if needed

Example error codes:
- profile.not_found
- profile.visibility_denied
- profile.username_taken
- profile.invalid_contact_method
- document.unsupported_format
- document.upload_failed
- document.not_found

## Persistence contract mapping

This domain reads and writes the following persistence surfaces:
- profiles
- contact_methods
- visibility_settings
- professor_schedule_documents

It must emit audit entries for:
- contact-method changes
- document upload or replacement
- verification badge display state changes
- document access

## Non-functional constraints

- visibility checks are enforced at read time, not only at rendering time
- upload validation includes extension, MIME, malware scan, and file-size guardrails
- timezone-aware rendering takes the campus timezone from system configuration
- default empty/optional fields must remain UI-safe even when profile data is partial

## Open design decisions

1. Should the public profile endpoint include a user summary plus a separate full-profile endpoint, or is a single profile payload sufficient?
2. Should verification status be readable by all authenticated users, or only by allowed role combinations?
