# QuakeStrike PH — PHIVOLCS Forecast Monitor

Private Astro SSR portal for PHIVOLCS operators to review current forecast revisions. Authentication is enforced by Cloudflare Access and independently verified by the application before any portal route is served.

```text
User → Cloudflare Access → Cloudflare Tunnel → cloudflared container
     → app:4321 (Docker network only) → Supabase
```

The Compose file publishes no host ports and includes no NGINX service. Configure the remotely managed tunnel's public hostname service as `http://app:4321` (or the matching `ASTRO_PORT`).

## Security behavior

- Every portal route except the minimal `/healthz` endpoint requires a valid `Cf-Access-Jwt-Assertion`.
- The app verifies the JWT signature, issuer, audience, expiry, and email claim against Cloudflare Access JWKS. It does not trust `Cf-Access-Authenticated-User-Email` by itself.
- Non-read requests must match `PORTAL_ORIGIN`, reducing cross-site request forgery risk.
- `DEV_AUTH_EMAIL` works only outside `NODE_ENV=production`.
- Supabase's server secret is read only by SSR code. No browser Supabase client or public key is used.
- Review and audit tables enable RLS without browser policies. Only the server secret can access them.

## Configure Cloudflare

1. Create a remotely managed Cloudflare Tunnel.
2. Add a public hostname and set its service URL to `http://app:4321`.
3. Create a self-hosted Cloudflare Access application for the same hostname.
4. Add the PHIVOLCS access policy and MFA requirements in Zero Trust.
5. Copy the application's AUD tag to `CF_ACCESS_AUD`.
6. Set `CF_ACCESS_TEAM_DOMAIN` to the exact HTTPS team origin, for example `https://your-team.cloudflareaccess.com`.
7. Copy `.env.example` to `.env` on the VPS and replace every placeholder.

Treat the tunnel token and Supabase secret as production secrets. Do not commit `.env`, print secrets in logs, or pass the Supabase secret to client-side scripts.

The VPS firewall or cloud security group should allow the tunnel's outbound connectivity but must not admit public inbound traffic on ports 80, 443, or 4321 for this portal. Verify the deployed `app` container still shows only `4321/tcp`, never a host binding such as `0.0.0.0:4321->4321/tcp`.

## Prepare Supabase

The approved migration is included but intentionally not applied to the remote project:

```text
supabase/migrations/20260716090000_add_forecast_reviews_and_audit_logs.sql
```

Review and apply it through the project's normal Supabase migration workflow before using the review form. It creates:

- `forecast_reviews`, keyed by event and forecast generation time so regenerated forecasts return to pending review while old reviews remain historical.
- `audit_logs`, used server-side for successful review mutations.

Both tables have RLS enabled and intentionally define no browser access policies.

## Local development

Install dependencies and configure a local `.env` with server-side Supabase credentials. `DEV_AUTH_EMAIL` supplies a development-only operator identity:

```powershell
pnpm install
pnpm dev
```

The production Compose stack ignores the development identity override. To test the real deployment path, configure valid Cloudflare and Supabase values, then run:

```powershell
docker compose --env-file .env up --build -d
docker compose ps
docker compose logs cloudflared
```

Open only the Cloudflare-protected hostname. The `app` service has no `ports` mapping, so `http://VPS_IP:4321` is not published.

## Verification

```powershell
pnpm test
pnpm check
pnpm build
docker compose --env-file .env.example config
```

Current scope ends after recording `REVIEWED_FOR_ALERT`. Real alert delivery remains deferred until recipient selection and channel-provider contracts are defined.
