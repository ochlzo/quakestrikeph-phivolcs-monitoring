import { GOOGLE_MAPS_API_KEY } from 'astro:env/server';
import type { APIRoute } from 'astro';

let session: { token: string; expiresAt: number } | undefined;

async function sessionToken(apiKey: string) {
	if (session && Date.now() < session.expiresAt - 60_000) return session.token;
	const response = await fetch(`https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mapType: 'roadmap', language: 'en-US', region: 'PH' }) });
	if (!response.ok) throw new Error(`Google Maps session failed: ${response.status}`);
	const data = await response.json() as { session?: string; expiry?: string };
	if (!data.session || !Number.isFinite(Number(data.expiry))) throw new Error('Google Maps session is invalid');
	session = { token: data.session, expiresAt: Number(data.expiry) * 1000 };
	return session.token;
}

export const GET: APIRoute = async ({ params }) => {
	const [z, x, y] = [Number(params.z), Number(params.x), Number(params.y)];
	const max = 2 ** z;
	if (!Number.isInteger(z) || z < 0 || z > 22 || !Number.isInteger(x) || x < 0 || x >= max || !Number.isInteger(y) || y < 0 || y >= max) return new Response('Invalid map tile', { status: 400 });
	const apiKey = GOOGLE_MAPS_API_KEY?.trim();
	if (!apiKey) return new Response('Google Maps is not configured', { status: 503 });
	try {
		const token = await sessionToken(apiKey);
		const response = await fetch(`https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${encodeURIComponent(token)}&key=${encodeURIComponent(apiKey)}`);
		if (!response.ok || !response.body) return new Response('Google Maps tile unavailable', { status: response.status });
		return new Response(response.body, { headers: { 'Cache-Control': response.headers.get('Cache-Control') ?? 'public, max-age=3600', 'Content-Type': response.headers.get('Content-Type') ?? 'image/png' } });
	} catch (error) {
		console.error('Unable to proxy Google Maps tile', error);
		return new Response('Google Maps tile unavailable', { status: 502 });
	}
};
