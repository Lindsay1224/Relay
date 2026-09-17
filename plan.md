# Relay — Phase 3: Manual Gmail Schedule Extraction

## Goal and V1 Boundary

Turn relevant Gmail messages into traceable family events through a parent-triggered, incremental sync. Gmail bodies and tokens remain server-side; Gemini receives only messages that pass deterministic relevance checks; every event retains inspectable source evidence.

V1 supports parent-triggered manual sync only—no scheduled polling or Gmail push notifications. It extracts sanitized email text and `.ics` attachments only; PDFs and every other attachment are out of scope. Potential changes and cancellations require parent review rather than automatically mutating an event.

## Architecture

```text
Authenticated dashboard
  │ POST /api/sync
  ▼
App Hosting / Next.js server
  ├─ validates Firebase session cookie, cooldown, and caps
  ├─ plans bounded Gmail work and enqueues tasks
  └─ returns 202 Accepted with sanitized sync state
          │
          ▼
Cloud Tasks (deterministic names, bounded concurrency)
          │ OIDC token, audience = private worker URL
          ▼
Private Cloud Run extraction worker (separate package)
  ├─ claims processing record transactionally
  ├─ decrypts refresh token; fetches exactly one Gmail message
  ├─ extracts bounded sanitized text and `.ics` signals
  ├─ applies relevance filter before Gemini
  ├─ calls Vertex AI Gemini with structured output for candidates only
  └─ writes events, sources, reviews, and sync progress
          │
          ▼
Firestore → authenticated dashboard reads and status polling
```

The worker has no public ingress. Cloud Tasks invokes it using OIDC. A task payload contains only `uid`, Gmail `messageId`, and deterministic `taskKey`—never a token, message content, or extraction output.

## Authentication and HTTP API

Replace encrypted ID-token and schedule cookies with Firebase session cookies. On sign-in, the server creates an HTTP-only, Secure, SameSite session cookie; protected server routes validate it. Firestore client rules remain deny-all and all reads go through authenticated server routes.

| Route | Contract |
| --- | --- |
| `POST /api/sync` | Requires a valid session. Enforces ownership, manual-sync cooldown, and candidate/task caps; plans and enqueues work, never extracts inline; returns `202 Accepted` with sanitized state. |
| `GET /api/sync-status` | Requires a valid session. Returns only caller-owned sanitized state: `idle`, `queued`, `processing`, `complete`, or `attention_needed`, with safe counters/timestamps. |
| `GET /api/events?from&to` | Requires a valid session. Validates ISO date/time range and returns only caller-owned events and source-evidence metadata in range. Never returns tokens or raw bodies. |

The dashboard polls sync status while work is active and loads persisted events for every returning authenticated user.

## Gmail Connection and Token Protection

`users/{uid}/gmailConnection` is canonical. On the next successful sync, inspect legacy `gmailConnections/{uid}`; transactionally migrate compatible connection data to the canonical path, then retire the legacy document only after that canonical write succeeds.

Refresh tokens use per-token envelope encryption:

```text
users/{uid}/gmailConnection
  email
  tokenCiphertext
  wrappedDataKey
  kmsKeyVersion
  tokenAlgorithm
  tokenCreatedAt
  sync.lastSuccessfulHistoryId
  sync.lastSuccessfulAt
  sync.recoveryState
```

On OAuth callback, App Hosting creates a data-encryption key, encrypts the refresh token, wraps the data key with Cloud KMS, and stores ciphertext plus key/version metadata. App Hosting can encrypt but cannot decrypt. Only the worker unwraps/decrypts immediately before Gmail use. Tokens and cryptographic fields must never appear in browser state, task payloads, responses, logs, or sanitized errors.

## Sync Planning, Cursoring, and Idempotency

Every manual sync creates or updates a per-user sync run using one bounded plan:

1. **Initial/recovery backfill:** list up to configured caps from the most recent 90 days of Inbox mail.
2. **Incremental sync:** use Gmail History API from `lastSuccessfulHistoryId`, collect relevant changed message IDs, deduplicate, then apply the same cap.
3. **Expired history cursor:** record `recoveryState: history_cursor_expired`, revert to bounded 90-day backfill, surface recovery/attention state, and preserve prior events.

Advance `lastSuccessfulHistoryId` only after a bounded run succeeds. Retain observed/target IDs on the run so failures or retries cannot falsely advance the successful cursor. Enforce manual-sync cooldowns, per-user candidate/task caps, queue concurrency, and Vertex request limits. Report only sanitized status and errors.

Create deterministic Cloud Tasks names from user, run/cursor scope, Gmail message ID, and extraction version (for example a SHA-256-derived safe name). Before work, the worker transactionally claims a processing record. A claimed or terminal record prevents at-least-once task delivery from duplicating extraction; a bounded stale lease may be safely reclaimed.

## Message Handling and Relevance Filtering

Only the worker fetches full Gmail messages. It must:

1. Fetch one message using a short-lived access token.
2. Parse MIME deterministically, preferring `text/plain`; otherwise derive text from sanitized HTML.
3. Cap decoded text and retain only a bounded sanitized excerpt; never persist raw MIME or raw bodies.
4. Parse `.ics` attachments deterministically and normalize their calendar signals. Ignore PDFs and other attachment types.
5. Build a source fingerprint from stable metadata and normalized, bounded source signals.
6. Apply the relevance filter before Gemini.

The filter considers subject, sender/domain, received date, sanitized text, and ICS signals. It boosts school, sports, appointment, explicit-date, and time language; rejects marketing, receipts, date-free newsletters, duplicates, and already-processed messages. Every message receives a processing record, including skips:

```text
status: queued | skipped | processed | failed
relevanceScore, sourceFingerprint, sanitizedReason
taskKey, attemptCount, leaseUntil, processedAt, extractionVersion
```

`sanitizedReason` is an enum or brief operational explanation, never copied body text or provider error content.

## Gemini Extraction and Validation

Only candidates go to Vertex AI Gemini. Send bounded, sanitized candidate fields and normalized ICS facts, not attachments or raw messages. Require structured JSON and explicitly instruct Gemini that all email-derived content is untrusted data, never instructions.

```json
{
  "events": [
    {
      "title": "Soccer practice",
      "category": "sports",
      "childName": "Maya",
      "startAt": "2026-09-18T17:30:00-04:00",
      "endAt": null,
      "allDay": false,
      "location": "Riverside Field",
      "confidence": 0.91,
      "evidence": "Practice is Thursday at 5:30 PM at Riverside Field.",
      "needsReview": false
    }
  ]
}
```

The server schema permits only known categories (`school`, `sports`, `appointment`, `activity`, `other`) and validates all output before a write: reject unknown fields/categories, impossible timestamps, invalid all-day combinations, strings over limits, confidence outside range, and unsupported evidence. Extract only source-supported facts; never invent a child, location, recurrence, or date; return no event for irreducibly ambiguous timing; flag reasonable uncertainty with `needsReview`.

## Firestore Model

```text
users/{uid}
  timezone

users/{uid}/gmailConnection
  email, tokenCiphertext, wrappedDataKey, kmsKeyVersion, tokenAlgorithm, tokenCreatedAt
  sync.lastSuccessfulHistoryId, sync.lastSuccessfulAt, sync.recoveryState

users/{uid}/syncRuns/{runId}
  state, startedAt, completedAt
  plannedCount, queuedCount, processingCount, processedCount, skippedCount, failedCount
  observedHistoryId, targetHistoryId, recoveryState, sanitizedError

users/{uid}/messageProcessing/{messageId}
  status, taskKey, sourceFingerprint, relevanceScore, sanitizedReason
  leaseUntil, attemptCount, processedAt, extractionVersion

users/{uid}/events/{eventId}
  title, normalizedTitle, category, childName
  startAt, endAt, allDay, timezone, location
  confidence, needsReview, extractionModel, extractionVersion, createdAt, updatedAt

users/{uid}/events/{eventId}/sources/{sourceId}
  messageId, threadId, sender, subject, receivedAt
  evidenceExcerpt, sourceFingerprint, extractionVersion, gmailThreadUrl

users/{uid}/reviews/{reviewId}
  kind: cancellation | change
  status: open | resolved | dismissed
  proposedEvent, sourceId, matchedEventId?, matchConfidence, createdAt
```

Use deterministic event IDs based on normalized extracted event fields and source identity. Write each event and its source evidence transactionally or with an idempotent batch. Multiple emails can add source documents to a single event.

For likely changes/cancellations, retain the original event and create a review record. Match conservatively by category, normalized title, child, and nearby event time. Add `matchedEventId` only for confident matches; otherwise create a standalone review item and alter no event.

## Dashboard Behavior

The authenticated dashboard requests events via `GET /api/events`, groups dates in the user’s configured timezone, and renders all-day events as dates rather than shifted instants. It provides:

- Manual sync controls with queued, processing, complete, and attention feedback.
- Sync-status polling while a run is active.
- An empty state for users with no events.
- Review indicators for event uncertainty and open change/cancellation reviews.
- A source-evidence drawer with sender, subject, received date, bounded excerpt, and Gmail thread link.

## IAM and Deployment

Deploy a dedicated private Cloud Run extraction service from a separate worker package.

| Principal | Minimum permissions |
| --- | --- |
| App Hosting service account | Firestore event/sync read-write, Cloud Tasks enqueue, KMS encrypt, required OAuth-secret access. No KMS decrypt. |
| Worker service account | Firestore processing/event/sync access, KMS decrypt, Vertex AI access, Gmail OAuth-secret access, Gmail API use. |
| Cloud Tasks caller service account | Cloud Run Invoker on this worker only. |
| Browser / Firestore client | No direct Firestore access; rules deny all. |

Configure task OIDC audience exactly as the worker URL. Restrict worker ingress to authenticated internal/task traffic; configure task retry/backoff/attempt limits, queue concurrency, and Vertex quotas explicitly.

## Implementation Sequence

1. Add session-cookie creation, verification, logout, and protected-route helpers; remove encrypted ID-token and schedule-cookie flows.
2. Add canonical Gmail connection persistence, OAuth envelope encryption, legacy migration on successful sync, and Firestore types.
3. Implement `POST /api/sync`, `GET /api/sync-status`, and `GET /api/events` with authorization, ownership, range validation, cooldowns, response sanitization, and `202` behavior.
4. Create the separate worker package, private Cloud Run deployment, queue, service accounts, and least-privilege IAM.
5. Implement 90-day backfill, Gmail History cursoring, expired-cursor recovery, deterministic task names, and run accounting.
6. Implement transactional claims, MIME/text/HTML/ICS extraction, bounded content handling, relevance filters, and terminal processing records.
7. Add Vertex structured extraction, schema validation, idempotent event/source writes, and change/cancellation review records.
8. Update dashboard event loading, timezone/all-day rendering, polling, evidence drawer, reviews, and empty state.
9. Complete fixture, route, browser, deployment, and controlled-inbox verification.

## Test and Verification Plan

Add Vitest tests for MIME extraction, HTML sanitization, bounded text, ICS parsing, relevance filtering, Gemini-schema validation, injection-safe model requests, event/source persistence, review matching, cursor-expiry recovery, and idempotent task retries/claims.

Add route tests for session authorization, sync ownership/cooldowns, event date-range access, and the absence of tokens/raw bodies in responses and task payloads. Add Playwright coverage for OAuth-complete dashboard loading, manual-sync progress, evidence drawer, empty state, and review-needed events.

After fixtures pass, run one controlled real-inbox sync and verify KMS envelope protection, task OIDC authentication, private worker access, source evidence/thread links, cursor behavior, and no duplicate events or raw Gmail content persisted outside the worker.

## Definition of Done

- An authenticated Gmail user starts manual sync and receives `202 Accepted` without waiting for extraction.
- Initial sync is limited to 90 recent Inbox days; later syncs use History API and recover safely from expired cursors.
- Only the private worker accesses full Gmail messages and decrypts refresh tokens.
- Only filtered candidates reach Gemini; all model output is strictly validated.
- Events are deduplicated, timezone-correct, support all-day display, and retain inspectable source evidence.
- Potential changes/cancellations are visibly reviewable without silent event mutation.
- At-least-once task retries do not duplicate processing or events.
- Unauthenticated users and Firestore clients cannot access data; responses, logs, and tasks reveal no tokens or raw message bodies.
