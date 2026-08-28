# API Design: FAQ & Moderation

This is the sixth complete API design in the series. It is scoped to Domain 6 only and follows the requirements as the behavioral source of truth and the schema as the persistence source of truth.

## Domain scope

This domain covers:
- question creation, search, and filtering
- answer creation and acceptance
- question and answer voting
- controlled category tags and tag filtering
- reporting and moderation review
- resolved/locked question workflow and edit windows
- anonymous question and answer submissions are explicitly excluded from MVP; `author_id` is required

This domain does not cover:
- timetable or enrollment operations
- import lifecycle
- announcement or reminder behavior
- profile or identity flows

## Actors

- Student
- Professor
- Admin

## Core principles

1. FAQ content is searchable and tag-filterable using a controlled tag set.
2. Votes are one per user per target and can be changed.
3. One accepted answer is allowed per question.
4. Questions can move through open/answered/resolved states and may be locked by policy.
5. Hidden or deleted content is excluded from default search results.
6. Moderation reports are handled as review items rather than as primary user content.
7. Questions and answers are subject to a fixed edit window.

## Resource model

### CategoryTag
A controlled category label for organizing questions.

Key properties:
- id
- label

### Question
A user-submitted question item.

Key properties:
- id
- author_id
- title
- body
- status
- is_locked
- hidden_at
- edit_window_expires_at
- created_at

### QuestionTag
Many-to-many mapping between a question and category tags.

Key properties:
- question_id
- category_tag_id

### Answer
A response to a question.

Key properties:
- id
- question_id
- author_id
- body
- is_accepted
- hidden_at
- created_at

### QuestionVote / AnswerVote
User-targeted vote on a question or answer.

Key properties:
- user_id
- target_id
- value
- updated_at

### Report
The moderation record for a reported question or answer.

Key properties:
- id
- reporter_id
- target_type
- target_id
- reason
- status
- created_at

## Public API surface

### 1. List category tags

GET /api/v1/faq/tags

Purpose:
- return the controlled set of category tags for search and submission

Response:
- list of tag records with id and label

Authorization:
- any authenticated user may read the tag list

### 2. Search questions

GET /api/v1/faq/questions

Purpose:
- search and filter questions by keyword, tag, and status

Query parameters:
- q optional
- tags[] optional
- status optional: open | answered | resolved
- sort optional: newest | popular
- limit required, integer 1..100
- cursor optional

Response:
- paginated question list
- question title, author summary, status, answer_count, vote summary, tag list

Authorization:
- any authenticated user may search visible questions

### 3. Get question detail

GET /api/v1/faq/questions/{questionId}

Purpose:
- retrieve a single question and associated answers

Response:
- question details
- answer list
- accepted answer, if present
- vote summary and current-user vote state, if available
- lock status and edit-window status

Query parameters for the answer list:
- answer_limit required, integer 1..100
- answer_cursor optional

Authorization:
- visible question content only

### 4. Ask a question

POST /api/v1/faq/questions

Purpose:
- create a new question

Request body:
- title
- body
- tags[]

Validation:
- title and body are required
- tags must be from the controlled list
- new question is created in open status
- edit_window_expires_at is created on question creation

Response:
- created question object
- edit_window_expires_at

### 5. Update a question

PUT /api/v1/faq/questions/{questionId}

Purpose:
- update a question while within the allowed edit window

Request body:
- title optional
- body optional
- tags[] optional

Validation:
- current user must own the question
- question must not be locked
- update must happen before edit_window_expires_at
- hidden content is not editable by default

Response:
- updated question

### 6. Resolve a question

POST /api/v1/faq/questions/{questionId}/resolve

Purpose:
- mark a question as resolved

Validation:
- only the question author may resolve the question
- resolved questions are locked to new answers; they can be reopened by the question author, a professor, or an admin

Response:
- updated question status

### 7. Reopen a question

POST /api/v1/faq/questions/{questionId}/reopen

Purpose:
- reopen a previously resolved or locked question

Validation:
- caller must be the question author, a professor, or an admin

### 8. Lock a question

POST /api/v1/admin/faq/questions/{questionId}/lock

Purpose:
- lock a question independently of its workflow status during moderation

Authorization:
- admin only

### 9. Unlock a question

POST /api/v1/admin/faq/questions/{questionId}/unlock

Purpose:
- remove an administrative content lock without changing the question status

Authorization:
- admin only

### 10. Hide a question

POST /api/v1/faq/questions/{questionId}/hide

Purpose:
- hide a question from default search results

Authorization:
- admin only

### 11. Answer a question

POST /api/v1/faq/questions/{questionId}/answers

Purpose:
- create an answer for a question

Request body:
- body

Validation:
- question must not be locked to new answers under default workflow
- body is required

Response:
- created answer object

### 12. Update an answer

PUT /api/v1/faq/answers/{answerId}

Purpose:
- update a user-owned answer

Validation:
- answer must belong to the current user
- hidden content is not editable unless policy allows it

### 13. Accept an answer

POST /api/v1/faq/answers/{answerId}/accept

Purpose:
- mark an answer as the accepted answer for that question

Validation:
- only one accepted answer per question is allowed
- question may be in an answerable workflow state according to policy
- only the question author, a professor, or an admin may accept an answer for that question

Response:
- updated answer and question metadata

### 14. Unaccept an answer

POST /api/v1/faq/answers/{answerId}/unaccept

Purpose:
- clear the accepted state for an answer when a better answer is chosen or the accepted state is later invalidated

Validation:
- only the question author, a professor, or an admin may unaccept an answer
- the answer must belong to the associated question and the target question must exist

Response:
- updated answer and question metadata

### 15. Hide an answer

POST /api/v1/faq/answers/{answerId}/hide

Purpose:
- hide a reported answer from standard FAQ views while preserving the historical record

Validation:
- caller must be allowed to moderate content
- answer must exist and be targetable for moderation

Response:
- updated answer visibility state

### 16. Vote on a question

POST /api/v1/faq/questions/{questionId}/votes

Purpose:
- create or update a vote on a question

Request body:
- value: like | dislike

Validation:
- one vote per user per question
- caller must not be the question author
- changing a vote updates the existing vote instead of creating a second one

Response:
- new vote state and aggregate counts

### 17. Vote on an answer

POST /api/v1/faq/answers/{answerId}/votes

Purpose:
- create or update a vote on an answer

Request body:
- value: like | dislike

Validation:
- one vote per user per answer
- caller must not be the answer author
- changing a vote updates the existing vote instead of creating a second one

### 18. Remove a question vote

DELETE /api/v1/faq/questions/{questionId}/votes

Purpose:
- remove the current user's vote from a question

Authorization:
- current user only

### 19. Remove an answer vote

DELETE /api/v1/faq/answers/{answerId}/votes

Purpose:
- remove the current user's vote from an answer

Authorization:
- current user only

### 20. Report content

POST /api/v1/faq/reports

Purpose:
- submit a report for a question or answer

Request body:
- target_type: question | answer
- target_id
- reason

Validation:
- target must exist
- reason must be provided

Response:
- created report record

### 21. List moderation reports

GET /api/v1/admin/faq/reports

Purpose:
- show open moderation items for admin review

Authorization:
- admin only

### 22. Resolve a report

POST /api/v1/admin/faq/reports/{reportId}/resolve

Purpose:
- resolve a moderation report after review

Request body:
- resolution_note optional

## Validation and behavioral rules

### Question lifecycle rules
- question states are open, answered, and resolved
- askers may mark their own questions resolved
- resolved questions are locked to new answers by default unless reopened by policy
- the edit window is fixed and configurable

### Vote rules
- exactly one vote per user per target item
- updating a vote replaces the previous value
- hidden or deleted content is excluded from default result sets

### Moderation rules
- report targets are content entities, not user actions
- moderation actions may hide content without deleting it
- admins can review open reports and resolve them

### Tag rules
- tags come from a controlled list
- multiple tags may be attached to a question
- legacy single-tag data is migrated before dropping the old column

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
- faq.question_locked
- faq.edit_window_expired
- faq.vote_already_exists
- faq.invalid_tag
- faq.answer_not_found
- faq.not_owned
- faq.report_target_invalid
- faq.content_hidden

## Persistence contract mapping

This domain reads and writes the following persistence surfaces:
- category_tags
- questions
- question_tags
- answers
- question_votes
- answer_votes
- reports

It must emit audit entries for:
- question state changes
- accepted answers
- moderation actions

## Non-functional constraints

- hidden or deleted items are excluded from default search results
- vote updates are atomic and consistent
- accepted-answer uniqueness is enforced at the database layer and validated in the API layer
- read performance is important for tag-and-keyword filtering
