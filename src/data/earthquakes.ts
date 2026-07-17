import {
	createDefaultMapFilters,
	MAX_MAP_EVENTS,
	type EarthquakeMapFilters,
} from '../lib/earthquake-map-filters.ts';
import type {
	EarthquakeMarker as PortalEarthquakeMarker,
	EarthquakeMarkerPage as PortalEarthquakeMarkerPage,
} from '../lib/portal-data.ts';

export type EarthquakeMarker = PortalEarthquakeMarker;
export type EarthquakeMarkerPage = PortalEarthquakeMarkerPage;

function setValue(params: URLSearchParams, name: string, value: string | number | null | undefined) {
	if (value !== null && value !== undefined && value !== '') params.set(name, String(value));
}

function portalDateBoundary(value: string | undefined, endOfDay = false) {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
	return `${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}+08:00`;
}

async function getEarthquakeMarkerPage(filters: EarthquakeMapFilters, offset: number, query: string | null) {
	if (offset >= MAX_MAP_EVENTS) return { events: [], nextOffset: MAX_MAP_EVENTS, hasMore: false, atLimit: true };

	const params = new URLSearchParams({
		offset: String(Math.max(0, Math.trunc(offset))),
		includeNoForecast: String(filters.forecasts.includeNoForecast),
	});
	setValue(params, 'query', query?.trim());
	if (filters.events.magnitude) params.set('magnitude', JSON.stringify(filters.events.magnitude));
	setValue(params, 'depthFrom', filters.events.depth?.from);
	setValue(params, 'depthTo', filters.events.depth?.to);
	setValue(params, 'dateFrom', portalDateBoundary(filters.events.date?.from));
	setValue(params, 'dateTo', portalDateBoundary(filters.events.date?.to, true));
	params.set('aftershock', filters.forecasts.aftershock24hLikelihoods.join(','));
	params.set('m5', filters.forecasts.m5PlusLikelihoods.join(','));
	setValue(params, 'minimumStrongest', filters.forecasts.minimumEstimatedStrongestAftershock);

	const response = await fetch(`/api/events?${params}`, { credentials: 'same-origin' });
	const data = await response.json() as EarthquakeMarkerPage & { error?: string };
	if (!response.ok) throw new Error(data.error ?? 'Could not load earthquake events.');
	return data;
}

export function searchEarthquakeMarkers(query: string, filters = createDefaultMapFilters(), offset = 0) {
	return getEarthquakeMarkerPage(filters, offset, query);
}

export function getRecentEarthquakeMarkerPage(filters = createDefaultMapFilters(), offset = 0) {
	return getEarthquakeMarkerPage(filters, offset, null);
}
