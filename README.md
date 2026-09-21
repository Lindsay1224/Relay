# Relay

Relay is a parent-triggered, Gmail-first family schedule application. Gmail content is fetched only by the private extraction worker; the app stores encrypted refresh tokens, structured events, and bounded evidence metadata—not raw email bodies.

## Local development

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local` when Firebase configuration is available.
3. Run `pnpm dev`.

## Production deployment

1. Create Secret Manager values for the OAuth client ID/secret and Firebase web API key.
2. Build and publish the worker image, then run `terraform -chdir=infra init` and `terraform -chdir=infra apply -var project_id=... -var worker_image=...`.
3. Put `terraform output -raw worker_url` into `RELAY_WORKER_URL` in App Hosting before deployment.

The Terraform module creates the private worker and grants Cloud Run invocation solely to the Cloud Tasks caller service account. Do not deploy with the placeholder worker URL.

## Status

- [x] Next.js application shell and responsive Relay experience
- [x] Firebase Admin session-cookie authentication and encrypted canonical Gmail connection
- [x] Bounded 90-day/history sync planner and private Cloud Tasks worker
- [x] MIME/ICS extraction, relevance gate, Gemini structured extraction, safe evidence metadata
- [x] Git-safe ignores for secrets and build output
- [ ] Firebase project, authentication, and App Hosting configuration
- [ ] Custom domain and staging deployment

## Deliberate boundaries

Gmail OAuth and message extraction are Phase 2. The existing connection experience is a visual demo until Google OAuth credentials and server-side token storage are configured.
