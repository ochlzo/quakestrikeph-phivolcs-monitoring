# QuakeStrike PH - PHIVOLCS Forecast Monitor

Private Astro SSR portal for authorized PHIVOLCS operators to inspect current forecast revisions and record reviews. Cloudflare Access protects the public hostname, the application independently validates the Access JWT, and Supabase access remains server-side.

```text
User -> Cloudflare Access -> Cloudflare Tunnel -> cloudflared container
     -> app:4321 on the Docker network -> Supabase
```

The current implementation provides the forecast queue and review workflow. `REVIEWED_FOR_ALERT` records that an operator wants to prepare an alert; alert composition and delivery are not implemented yet.

## Prerequisites

- Node.js 22.12 or newer
- Corepack and pnpm 11
- Docker Desktop, or Docker Engine with Docker Compose
- an active domain using Cloudflare DNS
- a Cloudflare Zero Trust account
- a Supabase project containing `RawEarthquakeEvents` and `SeisPredictions_v1`
- access to the Supabase project settings and database migration workflow

No VPS is required for initial testing. The Compose stack and tunnel can run from a developer workstation as long as Docker is running and the machine remains online.

## Environment variables

Copy `.env.example` to `.env` and replace every placeholder. `.env` is ignored by Git.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORTAL_ORIGIN` | Yes | Exact browser origin used for mutation-origin checks, such as `https://monitor.example.com` or `http://localhost:4321` for `pnpm dev`. |
| `CLOUDFLARED_TOKEN` | Compose | Secret token for the remotely managed Cloudflare Tunnel connector. |
| `CF_ACCESS_AUD` | Production | Audience tag from the self-hosted Cloudflare Access application. This is not the tunnel token. |
| `CF_ACCESS_TEAM_DOMAIN` | Production | Exact team origin, such as `https://your-team.cloudflareaccess.com`. |
| `ASTRO_PORT` | No | Internal app port; defaults to `4321`. Do not publish it on the host. |
| `SUPABASE_URL` | Yes | Supabase project URL used by server-side code. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server secret (`sb_secret_...` or legacy service-role key). An `sb_publishable_...` key will be rejected. |
| `DEV_AUTH_EMAIL` | Local dev only | Development identity for `pnpm dev`. Production Compose ignores it. |

Never commit `.env`, log the tunnel token or Supabase secret, or expose the Supabase secret through a public Astro environment variable.

## Cloudflare Access setup

Create Access protection before publishing the tunnel hostname.

1. In Cloudflare Zero Trust, go to **Access controls -> Applications**.
2. Create a **Self-hosted and private** application.
3. Add the public hostname, for example `monitor.example.com`.
4. Add an Allow policy using explicit operator email addresses.
5. Set the application session duration appropriate for the environment.
6. Save the application, then copy its **Application Audience (AUD) Tag** into `CF_ACCESS_AUD`.
7. Find the Zero Trust team name under Settings and set `CF_ACCESS_TEAM_DOMAIN` to `https://<team-name>.cloudflareaccess.com`.

Do not configure an Allow policy with `Everyone` or `Login Methods -> One-time PIN`; either can grant access more broadly than intended. Do not add a `Bypass` policy for portal routes.

### Email one-time PIN for testing

1. Go to **Zero Trust -> Integrations -> Identity providers**.
2. Add **One-time PIN**.
3. Configure the monitoring application.
4. Turn off accepting all identity providers and select only **One-time PIN**.
5. Keep **Authenticate with Cloudflare One Client** off unless managed-client access is intentionally introduced.
6. Confirm that the Allow policy contains the exact test email addresses.

OTP is for the current test phase. Before operational use, require independent MFA or connect the approved organization IdP with MFA and add the approved PHIVOLCS CIDR, VPN, or managed-device restriction.

Cloudflare documentation:

- [Self-hosted applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)
- [One-time PIN](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)
- [Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)

## Cloudflare Tunnel setup

1. Go to **Cloudflare Dashboard -> Networking -> Tunnels**.
2. Create a remotely managed tunnel and choose Docker as the connector environment.
3. Copy only the token from the generated Docker command into `CLOUDFLARED_TOKEN`.
4. Add a **Published application** route for the Access hostname.
5. Set the service URL to:

```text
http://app:4321
```

`app` is the Docker Compose service name. Do not use `localhost` from the `cloudflared` container, and do not point the hostname to a public IP. Cloudflare creates the DNS route to the tunnel.

The connector requires outbound connectivity to Cloudflare on TCP/UDP port `7844`. No router port forwarding or inbound host port is needed.

## Supabase migration

The portal migration is:

```text
supabase/migrations/20260716090000_add_forecast_reviews_and_audit_logs.sql
```

It creates:

- `forecast_reviews`, unique per event and forecast generation time
- `audit_logs`, for server-side operator mutation records

Both tables have RLS enabled and intentionally have no browser policies.

The repository currently contains migrations but no committed `supabase/config.toml`. Initialize and link the checkout once, then preview and apply pending migrations:

```powershell
npx supabase init
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list
```

Get `<project-ref>` from the Supabase dashboard URL. Review the dry run before applying it. Never use `supabase db reset --linked` against a shared or production project because it is destructive.

Supabase documentation: [Local development with migrations](https://supabase.com/docs/guides/local-development/overview)

## Install and verify

```powershell
corepack enable
pnpm install
pnpm test
pnpm check
pnpm build
```

The production dependency audit can be checked with:

```powershell
pnpm audit --prod
```

## Local UI development

For development without Cloudflare, set:

```env
PORTAL_ORIGIN=http://localhost:4321
DEV_AUTH_EMAIL=operator@example.com
```

Then run:

```powershell
pnpm dev
```

Open `http://localhost:4321`. The development identity works only when Astro is running in development mode.

## Test the real Cloudflare path

Set `PORTAL_ORIGIN` to the exact public HTTPS hostname and supply valid Cloudflare and Supabase values. `DEV_AUTH_EMAIL` can be removed; the Compose service does not pass it to the production app.

```powershell
docker compose --env-file .env up --build -d
docker compose ps
docker compose logs cloudflared --tail 100
docker compose logs app --tail 100
```

Open only the Cloudflare-protected hostname. Test from an Incognito window to force a fresh Access login.

`docker compose ps` should show the app with only:

```text
4321/tcp
```

It must not show a host binding such as:

```text
0.0.0.0:4321->4321/tcp
```

Stop the stack with:

```powershell
docker compose down
```

## Security behavior

- Every application route except the internal `/healthz` endpoint requires a valid `Cf-Access-Jwt-Assertion`.
- The app validates JWT signature, issuer, audience, expiry, and email against Cloudflare Access JWKS.
- Missing or invalid Access identity returns `401 Unauthorized`.
- Non-read requests whose `Origin` differs from `PORTAL_ORIGIN` return `403 Forbidden`.
- The app never trusts `Cf-Access-Authenticated-User-Email` by itself.
- The Supabase secret is used only by SSR code, and the runtime container runs as a non-root user.

Cloudflare Access is one security layer, not a replacement for application validation, MFA, host patching, secret rotation, audit review, and network restrictions.

## VPS deployment

When a VPS is available:

1. Stop the developer-workstation connector with `docker compose down` so Cloudflare does not route traffic to both machines.
2. Copy the repository to the VPS.
3. Create `.env` securely on the VPS; do not copy it through Git.
4. Allow required outbound traffic, including Cloudflare Tunnel port `7844` and HTTPS for Supabase and image pulls.
5. Do not allow public inbound access to ports `80`, `443`, or `4321` for this portal.
6. Run `docker compose --env-file .env up --build -d`.
7. Confirm the tunnel is healthy and the app has no published host port.

The existing tunnel token, hostname, and `http://app:4321` route can be reused. No DNS or public-IP change is required.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `401 Unauthorized` | Missing/invalid Access JWT, incorrect `CF_ACCESS_AUD`, or incorrect `CF_ACCESS_TEAM_DOMAIN`. |
| `403 Forbidden` while saving | Browser origin does not exactly match `PORTAL_ORIGIN`. |
| `Forecast queue unavailable` | Missing Supabase variables, wrong server key, missing migration, or unavailable source tables. |
| Service-role key rejected | An `sb_publishable_...` key was supplied instead of an `sb_secret_...` or legacy service-role key. |
| OTP email does not arrive | Email is not explicitly allowed, message is in spam, or an email scanner consumed the single-use PIN. |
| Tunnel is unhealthy | Invalid tunnel token, connector stopped, Docker networking issue, or outbound port `7844` blocked. |

## Maintenance

Update and recreate the tunnel connector periodically:

```powershell
docker compose pull cloudflared
docker compose --env-file .env up -d
```

After code changes, run:

```powershell
pnpm test
pnpm check
pnpm build
docker compose --env-file .env config --quiet
```

## Deferred scope

The current application stops after recording `REVIEWED_FOR_ALERT`. Do not add real alert delivery until recipient selection, delivery channels, provider credentials, confirmation behavior, and audit requirements are verified. The map, playback, complete freshness indicators, alert history, and UI refinement also remain future work.
