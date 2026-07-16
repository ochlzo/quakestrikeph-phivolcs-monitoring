import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import {
	authenticatedEmail,
	isTrustedMutationOrigin,
	normalizeTeamDomain,
	verifyAccessToken,
} from './cloudflare-access.ts';

test('verifies the Access issuer, audience, signature, and email', async () => {
	const { privateKey, publicKey } = await generateKeyPair('RS256');
	const publicJwk = await exportJWK(publicKey);
	publicJwk.kid = 'test-key';
	publicJwk.alg = 'RS256';
	const token = await new SignJWT({ email: 'Operator@Example.com' })
		.setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
		.setIssuer('https://team.cloudflareaccess.com')
		.setAudience('portal-audience')
		.setSubject('operator-id')
		.setExpirationTime('5m')
		.sign(privateKey);
	const user = await verifyAccessToken(
		token,
		{ audience: 'portal-audience', teamDomain: 'https://team.cloudflareaccess.com' },
		createLocalJWKSet({ keys: [publicJwk] }),
	);

	assert.deepEqual(user, { email: 'operator@example.com', subject: 'operator-id' });
	await assert.rejects(() => verifyAccessToken(
		token,
		{ audience: 'wrong', teamDomain: 'https://team.cloudflareaccess.com' },
		createLocalJWKSet({ keys: [publicJwk] }),
	));
});

test('rejects unsafe team domains and missing verified email claims', () => {
	assert.throws(() => normalizeTeamDomain('http://team.cloudflareaccess.com'));
	assert.throws(() => authenticatedEmail({ sub: 'operator-id' }));
});

test('allows mutations only from the configured portal origin', () => {
	assert.equal(isTrustedMutationOrigin(new Request('http://app/review', {
		method: 'POST',
		headers: { Origin: 'https://monitor.example.com' },
	}), 'https://monitor.example.com'), true);
	assert.equal(isTrustedMutationOrigin(new Request('http://app/review', {
		method: 'POST',
		headers: { Origin: 'https://attacker.example' },
	}), 'https://monitor.example.com'), false);
});
