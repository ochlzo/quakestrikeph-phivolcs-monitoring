import type { APIRoute } from 'astro';
import { getEarthquakeMarkerPage } from '@/lib/portal-data';

const number = (value: string | null) => value === null || value === '' ? null : Number(value);
const list = (value: string | null) => value ? value.split(',').filter(Boolean) : undefined;

export function parseMagnitudeRanges(value: string | null) {
	if (!value) return undefined;
	const ranges = JSON.parse(value) as unknown;
	if (!Array.isArray(ranges) || ranges.some((range) => {
		if (!range || typeof range !== 'object') return true;
		const item = range as { from?: unknown; to?: unknown; upperExclusive?: unknown };
		return typeof item.from !== 'number' || !Number.isFinite(item.from) || item.from < 0
			|| (item.to !== undefined && (typeof item.to !== 'number' || !Number.isFinite(item.to) || item.to < item.from))
			|| (item.upperExclusive !== undefined && typeof item.upperExclusive !== 'boolean');
	})) throw new Error('Invalid magnitude filters.');
	return ranges as Array<{ from: number; to?: number; upperExclusive?: boolean }>;
}

export const GET: APIRoute = async ({ url }) => {
	try {
		const query = url.searchParams.get('query')?.trim() || null;
		if (query && query.length < 3) return new Response(JSON.stringify({ error: 'Search requires at least 3 characters.' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
		const page = await getEarthquakeMarkerPage({
			offset: number(url.searchParams.get('offset')) ?? 0,
			query,
			magnitudeRanges: parseMagnitudeRanges(url.searchParams.get('magnitude')) ?? null,
			depthFrom: number(url.searchParams.get('depthFrom')),
			depthTo: number(url.searchParams.get('depthTo')),
			dateFrom: url.searchParams.get('dateFrom'),
			dateTo: url.searchParams.get('dateTo'),
			aftershockLikelihoods: list(url.searchParams.get('aftershock')),
			m5Likelihoods: list(url.searchParams.get('m5')),
			minimumStrongest: number(url.searchParams.get('minimumStrongest')),
			includeNoForecast: url.searchParams.get('includeNoForecast') !== 'false',
		});
		return Response.json(page, { headers: { 'Cache-Control': 'no-store' } });
	} catch (error) {
		if (error instanceof SyntaxError || (error instanceof Error && error.message === 'Invalid magnitude filters.')) {
			return Response.json({ error: 'Invalid magnitude filters.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
		}
		return Response.json({ error: error instanceof Error ? error.message : 'Could not load events.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
	}
};
