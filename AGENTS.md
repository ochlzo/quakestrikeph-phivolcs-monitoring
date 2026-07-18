# AGENTS.md

## Project purpose

This project is the private QuakeStrike PH monitoring portal for personnel delegated by PHIVOLCS to review system forecasts and send alerts.

It is a separate internal application, not a hidden route in the public `quakestrikeph-frontend` website. The public frontend may be consulted for existing map, forecast-discussion, playback, and terminology patterns, but access control and operational actions belong here.

## Current implementation baseline

The repository currently contains a working first review slice:

- Astro SSR with the standalone Node adapter
- a server-rendered forecast queue backed by Supabase
- a forecast review page with editable pre-written assessments
- a map monitoring workspace with explicit 50-row pagination up to 2,000 events
- a required child forecast-details sidebar and shared review dialog
- iframe-ready forecast discussion and observation playback
- audit-log and raw-event list pages
- a minimal server-managed operator display profile
- review statuses `PENDING_REVIEW`, `DRAFT`, `REVIEWED_NO_ALERT`, and `REVIEWED_FOR_ALERT`
- server-side review persistence and audit logging
- Cloudflare Access JWT validation in Astro middleware
- Docker Compose services for the Astro app and a remotely managed Cloudflare Tunnel

The app and tunnel can run on a developer workstation before a VPS exists. The tunnel route is `http://app:4321` because `app` is the Docker Compose service name. No public IP, A record, router port forwarding, or host port is required. When the VPS is ready, stop the local connector and run the same Compose stack there; the Cloudflare hostname and tunnel route do not need to change.

The current Cloudflare login method is email one-time PIN for testing. Cloudflare settings and secrets are external state and are not committed. Do not assume the current Access policy, tunnel health, remote migration state, or secret values from repository files; verify them when relevant.

## Implemented versus deferred

Implemented now:

- current forecast queue from `SeisPredictions_v1` joined to `RawEarthquakeEvents`
- current-revision review loading and saving
- editable review templates and internal notes
- superseded-revision rejection before saving
- reviewer attribution from the verified Cloudflare Access JWT
- audit rows for successful review mutations

Still deferred:

- full source-freshness indicators beyond forecast playback status
- alert composer, recipients, delivery channels, confirmation, retries, and corrections
- alert history and delivery-result screens
- organization IdP integration, independent MFA, and PHIVOLCS CIDR/VPN enforcement
- UI refinement beyond the functional review workflow

`REVIEWED_FOR_ALERT` is only a review state. It does not send an alert. Do not invent an alert provider, recipient model, or delivery contract to advance this state.

## Product scope

PHIVOLCS operators may:

- view the forecast monitoring queue and map
- inspect an event, its current forecast, source freshness, and observed activity
- write and save a forecast review
- mark a forecast reviewed with no alert
- compose, preview, confirm, and send an alert without a separate approval step
- view review history, sent alerts, and delivery results
- send a follow-up or correction for a previously sent alert

PHIVOLCS operators may not:

- create or manage user accounts or permissions
- edit or delete raw earthquake events or model predictions
- configure, train, promote, or run forecasting models
- administer ingestion, processing, or alert infrastructure

PHIVOLCS decides outside the application which personnel are authorized to use the portal. The application enforces the resulting access; it does not implement an internal delegation or approval workflow.

## Core workflow

1. A new or regenerated forecast enters the pending-review queue.
2. An operator inspects the trigger event, forecast values, generation time, source status, and playback observations.
3. The operator records a review and either marks it reviewed with no alert or prepares an alert.
4. The operator selects the audience and channels, previews the final message and recipient count, then confirms the send.
5. The system records the operator, forecast revision, message, recipients, timestamps, and delivery results.

Sending an alert does not require another PHIVOLCS approver. Keep a final confirmation step to prevent accidental sends.

## Operational rules

- Alerts are human-initiated. Never automatically send an alert from a model result.
- Do not automatically translate model likelihood levels into official alert severity.
- A sent alert is immutable. Corrections and changed guidance create a linked follow-up alert.
- If an event or forecast is regenerated, mark the earlier forecast as superseded and return the current forecast to the review queue.
- Never allow an alert to be sent from a superseded forecast.
- Keep review status separate from alert delivery status.
- Display all operational timestamps in Philippine Time and retain UTC in stored records where supported.
- Describe forecast outputs as probability estimates, not deterministic earthquake predictions.
- Describe playback observations as possibly related screened earthquakes, not confirmed aftershocks.

## Primary screens

### Monitor

- pending and reviewed forecast lists
- live earthquake map
- selected-event forecast summary
- catalog, forecast-processing, and alert-delivery freshness indicators
- search and operational filters

### Forecast review

- trigger magnitude, depth, time, location, and coordinates
- forecast generation time and current/superseded state
- 24-hour aftershock likelihood
- magnitude-5-or-higher likelihood
- estimated strongest aftershock
- distance-band probabilities and most-likely distance
- playback observations and observed-through watermark
- PHIVOLCS review text and internal note
- `Save draft`, `Mark reviewed - no alert`, and `Prepare alert` actions

### Alert composer

- alert type: initial, update, or correction
- audience and estimated recipient count
- configured delivery channels
- editable message with per-channel preview
- `Save draft` and `Confirm and send` actions

### History

- reviews with reviewer identity and timestamps
- immutable sent messages
- forecast revision used for each alert
- per-channel delivery totals and failures
- retry failed deliveries and send follow-up actions

## Access and security

- Use invite-only authentication and server-enforced authorization.
- A client-side route guard is not a security boundary.
- Protect the portal at the network layer with approved PHIVOLCS source CIDRs or an organization-approved VPN, plus normal authentication and MFA.
- Treat recorded IP addresses as audit signals, not user identity.
- Never expose server credentials, database connection strings, or service-role keys to browser code or logs.
- All review and alert mutations must be attributable to the authenticated operator.

### Current security mechanics

- `src/middleware.ts` protects every application route except `/healthz`.
- `src/lib/cloudflare-access.ts` validates `Cf-Access-Jwt-Assertion` with Cloudflare JWKS and checks signature, issuer, audience, expiry, and email. Never replace this with trust in `Cf-Access-Authenticated-User-Email` alone.
- Missing or invalid Access identity returns `401 Unauthorized`.
- A mutation whose `Origin` does not exactly match `PORTAL_ORIGIN` returns `403 Forbidden`.
- `PORTAL_ORIGIN` must be the exact browser origin. Use the public HTTPS hostname through the tunnel and `http://localhost:4322` only for local `pnpm dev`; port `4321` is reserved for the public frontend used by the development forecast iframe.
- Forecast iframes always load from `https://quakestrikeph.qzz.io`; do not add a localhost or environment-variable fallback.
- `DEV_AUTH_EMAIL` is a local-development override only. Production Compose runs with `NODE_ENV=production` and does not pass it to the app. Never add it to the production service environment.
- The Compose `app` service uses `expose`, not `ports`; keep it unreachable from host ports.
- The runtime image runs as the non-root `node` user.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Reject `sb_publishable_` keys and never add a browser Supabase client unless a separately reviewed use case requires it.
- `/healthz` intentionally bypasses Astro identity checks for the internal container health check. The public hostname must still be covered by the Access application.

For OTP policies, allow explicit operator email addresses. Do not use `Include -> Everyone`, `Include -> Login Methods -> One-time PIN`, or broad `Bypass` policies. OTP is acceptable for testing; production still requires independent MFA or an organization IdP with MFA plus the approved PHIVOLCS network restriction.

## Data contract

- Source tables already expected in Supabase: `RawEarthquakeEvents` and `SeisPredictions_v1`.
- Portal migration: `supabase/migrations/20260716090000_add_forecast_reviews_and_audit_logs.sql`.
- Operator profile migration: `supabase/migrations/20260717090000_add_operator_profiles.sql`.
- Review/operator relation migration: `supabase/migrations/20260717152242_link_forecast_reviews_to_operator_profiles.sql`.
- `forecast_reviews` is unique on `(event_id, forecast_created_at)`, preserving a separate review per forecast revision.
- `forecast_reviews.operator_id` is a required foreign key to `operator_profiles.id`; the review table does not duplicate the operator email.
- `audit_logs` records the authenticated email, path, method, timestamp, and mutation metadata.
- All portal-owned tables have RLS enabled with no browser policies. Access is intentionally through server-side Supabase credentials only.
- `operator_profiles` uses a generated numeric ID, keeps verified email unique, and stores display name and timestamps; profile mutations derive email from the Access JWT and write an audit row.
- Review and query logic belongs in `src/lib/portal-data.ts`, not in UI components.

Do not assume that the migration file has been applied to the linked remote project. Check migration history or the live schema before debugging review persistence.

## Integration boundaries

- `C:\Projects\quakestrikeph-frontend` is the reference for the existing public map and forecast-discussion experience.
- `C:\Projects\quakestrikeph-backend` is the reference for current ingestion, prediction, and backend integration behavior.
- Inspect the live schema and API contracts before implementing data access. Do not invent tables, endpoints, alert providers, or recipient rules.
- Keep external data-access and send logic outside UI components.

## Implementation guidance

- Prefer the smallest working solution and follow current repo patterns.
- Use current repo files and verified integration contracts as the source of truth.
- Prefer Astro components and server rendering by default; add client-side framework components only for necessary interaction.
- Reuse existing design tokens and shared components before adding local styles or abstractions.
- Keep components focused and split files before they become difficult to review.
- Preserve accessibility for forms, dialogs, status messages, maps, and confirmation actions.
- Ask before implementing when alert channels, recipient selection, review publication, auth, or API behavior is not defined by current code.

## Development

Prerequisites are Node.js 22.12 or newer, pnpm 11 through Corepack, and Docker Desktop or another Docker Compose-compatible runtime.

Install and verify with the existing package scripts:

```powershell
corepack enable
pnpm install
pnpm test
pnpm check
pnpm build
```

For local UI work, copy `.env.example` to `.env`, use `PORTAL_ORIGIN=http://localhost:4322`, set a non-production `DEV_AUTH_EMAIL`, and run:

```powershell
pnpm dev
```

For the real Cloudflare path, use the public HTTPS portal origin, valid Cloudflare and Supabase values, and run:

```powershell
docker compose --env-file .env up --build -d
docker compose ps
docker compose logs cloudflared --tail 100
```

Expected production port output is `4321/tcp`, never `0.0.0.0:4321->4321/tcp`.

Before changing authentication, data access, migrations, or deployment, read `README.md`, inspect the current Compose and middleware files, and preserve the security properties above. After changes, run the smallest relevant check and normally finish with `pnpm test`, `pnpm check`, and `pnpm build`.
