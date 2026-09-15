# Relay

Relay is a Gmail-first family schedule demo. This Phase 1 baseline is a Next.js application ready for Firebase App Hosting / Cloud Run.

## Local development

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local` when Firebase configuration is available.
3. Run `pnpm dev`.

## Phase 1 status

- [x] Next.js application shell and responsive Relay experience
- [x] Environment-variable contract for Firebase and upcoming Gmail OAuth
- [x] Git-safe ignores for secrets and build output
- [ ] Firebase project, authentication, and App Hosting configuration
- [ ] Custom domain and staging deployment

## Deliberate boundaries

Gmail OAuth and message extraction are Phase 2. The existing connection experience is a visual demo until Google OAuth credentials and server-side token storage are configured.
