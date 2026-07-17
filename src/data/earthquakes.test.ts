import assert from 'node:assert/strict';
import test from 'node:test';
import { searchEarthquakeMarkers, type EarthquakeMarkerPage } from './earthquakes.ts';
import { createDefaultMapFilters } from '../lib/earthquake-map-filters.ts';

test('adapts public map filters to the protected same-origin events endpoint', async () => {
	const originalFetch = globalThis.fetch;
	let requestUrl = '';
	const expected: EarthquakeMarkerPage = { events: [], nextOffset: 50, hasMore: true, atLimit: false };
	globalThis.fetch = async (input, init) => {
		requestUrl = String(input);
		assert.equal(init?.credentials, 'same-origin');
		return Response.json(expected);
	};

	try {
		const filters = createDefaultMapFilters();
		filters.events.magnitude = [{ from: 3, to: 4, upperExclusive: true }];
		filters.events.depth = { from: '5', to: '20' };
		filters.events.date = { from: '2026-07-01', to: '2026-07-17' };
		filters.forecasts.aftershock24hLikelihoods = ['high'];
		filters.forecasts.m5PlusLikelihoods = ['medium', 'high'];
		filters.forecasts.minimumEstimatedStrongestAftershock = 4.5;
		filters.forecasts.includeNoForecast = false;

		assert.deepEqual(await searchEarthquakeMarkers('  Cebu  ', filters, 50), expected);
		const url = new URL(requestUrl, 'https://portal.example');
		assert.equal(url.pathname, '/api/events');
		assert.equal(url.searchParams.get('offset'), '50');
		assert.equal(url.searchParams.get('query'), 'Cebu');
		assert.deepEqual(JSON.parse(url.searchParams.get('magnitude')!), filters.events.magnitude);
		assert.equal(url.searchParams.get('depthFrom'), '5');
		assert.equal(url.searchParams.get('depthTo'), '20');
		assert.equal(url.searchParams.get('dateFrom'), '2026-07-01T00:00:00+08:00');
		assert.equal(url.searchParams.get('dateTo'), '2026-07-17T23:59:59.999+08:00');
		assert.equal(url.searchParams.get('aftershock'), 'high');
		assert.equal(url.searchParams.get('m5'), 'medium,high');
		assert.equal(url.searchParams.get('minimumStrongest'), '4.5');
		assert.equal(url.searchParams.get('includeNoForecast'), 'false');
	} finally {
		globalThis.fetch = originalFetch;
	}
});
