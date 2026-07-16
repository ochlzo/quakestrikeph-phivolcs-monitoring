import { defineMiddleware } from 'astro:middleware';
import {
	CF_ACCESS_AUD,
	CF_ACCESS_TEAM_DOMAIN,
	DEV_AUTH_EMAIL,
	PORTAL_ORIGIN,
} from 'astro:env/server';
import { getAccessUser, isTrustedMutationOrigin } from './lib/cloudflare-access';

const UNPROTECTED_PATHS = new Set(['/healthz']);

function unauthorized() {
	return new Response('Unauthorized', {
		status: 401,
		headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
	});
}

export const onRequest = defineMiddleware(async ({ locals, request, url }, next) => {
	if (UNPROTECTED_PATHS.has(url.pathname)) return next();

	try {
		const user = await getAccessUser(request, {
			audience: CF_ACCESS_AUD,
			teamDomain: CF_ACCESS_TEAM_DOMAIN,
			developmentEmail: DEV_AUTH_EMAIL,
		}, import.meta.env.DEV);
		if (!user) return unauthorized();
		if (!isTrustedMutationOrigin(request, PORTAL_ORIGIN, import.meta.env.DEV)) {
			return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });
		}
		locals.user = user;
		return next();
	} catch (error) {
		console.error('Cloudflare Access verification failed:', error instanceof Error ? error.message : 'unknown error');
		return unauthorized();
	}
});
