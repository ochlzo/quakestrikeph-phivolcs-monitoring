import {
	createRemoteJWKSet,
	jwtVerify,
	type JWTPayload,
	type JWTVerifyGetKey,
} from 'jose';

export type AccessUser = { email: string; subject: string };
export type AccessConfig = { audience: string; teamDomain: string };
export type AccessEnvironment = {
	audience?: string;
	teamDomain?: string;
	developmentEmail?: string;
};

let cachedTeamDomain = '';
let cachedKeySet: JWTVerifyGetKey | undefined;

export function normalizeTeamDomain(value: string) {
	const url = new URL(value);
	if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) {
		throw new Error('CF_ACCESS_TEAM_DOMAIN must be an HTTPS origin');
	}
	return url.origin;
}

export function authenticatedEmail(payload: JWTPayload) {
	if (typeof payload.email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email)) {
		throw new Error('Verified Cloudflare Access token has no valid email claim');
	}
	return payload.email.toLowerCase();
}

export async function verifyAccessToken(
	token: string,
	config: AccessConfig,
	keySet?: JWTVerifyGetKey,
): Promise<AccessUser> {
	const teamDomain = normalizeTeamDomain(config.teamDomain);
	if (!keySet && (teamDomain !== cachedTeamDomain || !cachedKeySet)) {
		cachedTeamDomain = teamDomain;
		cachedKeySet = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
	}
	const jwks = keySet ?? cachedKeySet!;
	const { payload } = await jwtVerify(token, jwks, {
		issuer: teamDomain,
		audience: config.audience,
	});

	return {
		email: authenticatedEmail(payload),
		subject: typeof payload.sub === 'string' ? payload.sub : authenticatedEmail(payload),
	};
}

export async function getAccessUser(
	request: Request,
	environment: AccessEnvironment,
	allowDevelopmentIdentity = false,
): Promise<AccessUser | null> {
	const developmentEmail = allowDevelopmentIdentity ? environment.developmentEmail?.trim() : undefined;
	if (developmentEmail) {
		return { email: authenticatedEmail({ email: developmentEmail }), subject: 'development-user' };
	}

	const token = request.headers.get('Cf-Access-Jwt-Assertion');
	if (!token) return null;

	const audience = environment.audience?.trim();
	const teamDomain = environment.teamDomain?.trim();
	if (!audience || !teamDomain) {
		throw new Error('Cloudflare Access environment variables are not configured');
	}

	return verifyAccessToken(token, { audience, teamDomain });
}

export function isTrustedMutationOrigin(
	request: Request,
	portalOrigin?: string,
	allowRequestOriginFallback = false,
) {
	if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
		return true;
	}

	const origin = request.headers.get('Origin');
	const expectedOrigin = portalOrigin?.trim() || (allowRequestOriginFallback
		? new URL(request.url).origin
		: '');
	if (!origin || !expectedOrigin) return false;

	try {
		return new URL(origin).origin === new URL(expectedOrigin).origin;
	} catch {
		return false;
	}
}
