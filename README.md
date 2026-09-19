# WaseShibu Progress Cloud

Dedicated source-of-truth repository for the shared Cloudflare learning-progress backend used by all WaseShibu study apps.

## Supported apps

- `kokugo` — 国語
- `math` — 数学
- `english` — 英語
- `listening` — リスニング
- `vocab` — 英単語

## Production identity

This repository deploys to the **existing** Cloudflare resources:

- Worker: `waseshibu-progress-api`
- Durable Object binding: `PROGRESS`
- Durable Object class: `HouseholdProgress`
- Durable Object name: `family-main`

Moving the code here does **not** create, clear, migrate, or replace the existing Durable Object or stored learner data. Existing `app_id='kokugo'` rows remain valid.

## Architecture

- one Worker for all subjects
- one shared registration/device model
- events and snapshots separated by `app_id`
- learner apps remain local-first
- anonymous silent registration remains supported
- admin dashboard is served at `/admin`
- Cloudflare Access must protect only `/admin` and `/admin/*`, never the whole Worker

## Local validation

```bash
npm install
npm test
npx wrangler deploy --dry-run --outdir dist
```

## Production deploy

```bash
npm install
npx wrangler login
npm run deploy
```

Secrets remain configured on the existing Worker and are not stored in this repository. Required/optional Worker secrets include `ADMIN_SECRET` and optionally `ACCESS_ALLOWED_EMAILS`. The Cloudflare Access team domain and Audience ID are public identifiers and are versioned in `src/accessConfig.js`; do not move them back to secrets, because hidden values can drift from the Access application without review.

## Safety invariants

- existing learner `localStorage` / IndexedDB is never cleared by this backend
- raw answers, passages, explanations, draft bodies and export payloads are not accepted
- unknown `appId` values are rejected
- event identity remains registration + app + local record + revision scoped
- rate-limit responses remain retryable
- revoked credentials cannot upload new data
- `ignored` excludes a device from formal progress
- the current Worker name, Durable Object class/binding/name and SQLite tables stay unchanged

## Repository ownership

Cloud backend changes belong in this repository. Subject repositories should only contain their frontend integration/client code and subject-specific mapping to the shared progress contract.

## Admin recovery and observability

- Worker invocation logs are enabled and persisted with query strings redacted.
- Access validation failures emit structured `access_validation_failed` entries with a reason, path, Ray ID, and no JWT or email.
- Dashboard request failures emit structured `dashboard_request_failed` entries.
- If the Access application is recreated, update `src/accessConfig.js` in the same change as the Access configuration and run `npm test` before deploying.
- A healthy unauthenticated `/admin` request redirects to `https://fyam8.cloudflareaccess.com/`; `/health` remains public for uptime checks.
