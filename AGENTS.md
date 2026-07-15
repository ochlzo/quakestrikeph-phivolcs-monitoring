# AGENTS.md

## Project purpose

This project is the private QuakeStrike PH monitoring portal for personnel delegated by PHIVOLCS to review system forecasts and send alerts.

It is a separate internal application, not a hidden route in the public `quakestrikeph-frontend` website. The public frontend may be consulted for existing map, forecast-discussion, playback, and terminology patterns, but access control and operational actions belong here.

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

Install and verify with the existing package scripts:

```powershell
pnpm install
pnpm run build
```

Run the development server in background mode:

```powershell
astro dev --background
astro dev status
astro dev logs
astro dev stop
```

Astro documentation: https://docs.astro.build
