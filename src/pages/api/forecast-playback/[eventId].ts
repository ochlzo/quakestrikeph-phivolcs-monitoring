import type { APIRoute } from 'astro';
import { getForecastPlaybackPage } from '@/lib/portal-data';

export const GET: APIRoute = async ({ params, url }) => {
	try {
		if (!params.eventId) return Response.json({ error: 'Event ID is required.' }, { status: 400 });
		const scope = url.searchParams.get('scope');
		const page = await getForecastPlaybackPage(params.eventId, url.searchParams.get('cursorTime') && url.searchParams.get('cursorId') ? { eventTime: url.searchParams.get('cursorTime')!, eventId: url.searchParams.get('cursorId')! } : null, scope === '100km' || scope === 'all' ? scope : 'gk');
		return page ? Response.json(page, { headers: { 'Cache-Control': 'no-store' } }) : Response.json({ error: 'Playback unavailable.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
	} catch (error) {
		return Response.json({ error: error instanceof Error ? error.message : 'Could not load playback.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
	}
};
