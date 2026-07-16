import type { ReviewInput, ReviewStatus } from './reviews';
import { getSupabaseAdmin } from './supabase-server';

type EventRow = {
	id: string;
	'Date-Time': string;
	Latitude: number;
	Longitude: number;
	Depth: number | string;
	Magnitude: number;
	Location: string | null;
	event_time: string | null;
};

type PredictionRow = {
	event_id: string;
	created_at: string;
	aftershock_24h: number | null;
	m5_plus_aftershock: number | null;
	within_10km: number | null;
	between_10_25km: number | null;
	between_25_50km: number | null;
	beyond_50km: number | null;
	est_max_aftershock: number | null;
	aftershock_24h_likelihood_level: string | null;
	m5_plus_likelihood_level: string | null;
};

export type ReviewRow = {
	id: number;
	event_id: string;
	forecast_created_at: string;
	status: ReviewStatus;
	review_text: string;
	internal_note: string;
	reviewer_email: string;
	reviewed_at: string | null;
	updated_at: string;
};

export type ForecastCase = {
	event: EventRow;
	forecast: PredictionRow;
	review: ReviewRow | null;
};

const PREDICTION_FIELDS = `
	event_id, created_at, aftershock_24h, m5_plus_aftershock,
	within_10km, between_10_25km, between_25_50km, beyond_50km,
	est_max_aftershock, aftershock_24h_likelihood_level, m5_plus_likelihood_level
`;
const EVENT_FIELDS = 'id, "Date-Time", "Latitude", "Longitude", "Depth", "Magnitude", "Location", event_time';
const REVIEW_FIELDS = 'id, event_id, forecast_created_at, status, review_text, internal_note, reviewer_email, reviewed_at, updated_at';

function requireData<T>(data: T | null, error: { message: string } | null, action: string): T {
	if (error) throw new Error(`${action}: ${error.message}`);
	if (data === null) throw new Error(`${action}: no data returned`);
	return data;
}

function revisionKey(eventId: string, createdAt: string) {
	return `${eventId}:${new Date(createdAt).toISOString()}`;
}

export async function getForecastQueue(limit = 40): Promise<ForecastCase[]> {
	const supabase = getSupabaseAdmin();
	const predictionsResult = await supabase
		.from('SeisPredictions_v1')
		.select(PREDICTION_FIELDS)
		.order('created_at', { ascending: false })
		.limit(limit);
	const predictions = requireData(
		predictionsResult.data as PredictionRow[] | null,
		predictionsResult.error,
		'Could not load forecasts',
	);
	if (!predictions.length) return [];

	const eventIds = predictions.map(({ event_id }) => event_id);
	const [eventsResult, reviewsResult] = await Promise.all([
		supabase.from('RawEarthquakeEvents').select(EVENT_FIELDS).in('id', eventIds),
		supabase.from('forecast_reviews').select(REVIEW_FIELDS).in('event_id', eventIds),
	]);
	const events = requireData(eventsResult.data as EventRow[] | null, eventsResult.error, 'Could not load events');
	const reviews = requireData(reviewsResult.data as ReviewRow[] | null, reviewsResult.error, 'Could not load reviews');
	const eventById = new Map(events.map((event) => [event.id, event]));
	const reviewByRevision = new Map(reviews.map((review) => [
		revisionKey(review.event_id, review.forecast_created_at),
		review,
	]));

	return predictions.flatMap((forecast) => {
		const event = eventById.get(forecast.event_id);
		if (!event) return [];
		return [{
			event,
			forecast,
			review: reviewByRevision.get(revisionKey(forecast.event_id, forecast.created_at)) ?? null,
		}];
	});
}

export async function getForecastCase(eventId: string): Promise<ForecastCase | null> {
	const supabase = getSupabaseAdmin();
	const [eventResult, forecastResult] = await Promise.all([
		supabase.from('RawEarthquakeEvents').select(EVENT_FIELDS).eq('id', eventId).maybeSingle(),
		supabase.from('SeisPredictions_v1').select(PREDICTION_FIELDS).eq('event_id', eventId).maybeSingle(),
	]);
	if (eventResult.error) throw new Error(`Could not load event: ${eventResult.error.message}`);
	if (forecastResult.error) throw new Error(`Could not load forecast: ${forecastResult.error.message}`);
	if (!eventResult.data || !forecastResult.data) return null;

	const forecast = forecastResult.data as PredictionRow;
	const reviewResult = await supabase
		.from('forecast_reviews')
		.select(REVIEW_FIELDS)
		.eq('event_id', eventId)
		.eq('forecast_created_at', forecast.created_at)
		.maybeSingle();
	if (reviewResult.error) throw new Error(`Could not load review: ${reviewResult.error.message}`);

	return {
		event: eventResult.data as EventRow,
		forecast,
		review: reviewResult.data as ReviewRow | null,
	};
}

export async function saveForecastReview(
	eventId: string,
	forecastCreatedAt: string,
	operatorEmail: string,
	input: ReviewInput,
	path: string,
) {
	const supabase = getSupabaseAdmin();
	const currentResult = await supabase
		.from('SeisPredictions_v1')
		.select('created_at')
		.eq('event_id', eventId)
		.maybeSingle();
	if (currentResult.error) throw new Error(`Could not verify forecast revision: ${currentResult.error.message}`);
	if (!currentResult.data || revisionKey(eventId, currentResult.data.created_at) !== revisionKey(eventId, forecastCreatedAt)) {
		throw new Error('This forecast was superseded. Reload and review the current forecast.');
	}

	const now = new Date().toISOString();
	const result = await supabase.from('forecast_reviews').upsert({
		event_id: eventId,
		forecast_created_at: forecastCreatedAt,
		status: input.status,
		review_text: input.reviewText,
		internal_note: input.internalNote,
		reviewer_email: operatorEmail,
		reviewed_at: input.status.startsWith('REVIEWED_') ? now : null,
		updated_at: now,
	}, { onConflict: 'event_id,forecast_created_at' });
	if (result.error) throw new Error(`Could not save review: ${result.error.message}`);

	const auditResult = await supabase.from('audit_logs').insert({
		user_email: operatorEmail,
		path,
		method: 'POST',
		metadata: { action: 'save_forecast_review', event_id: eventId, forecast_created_at: forecastCreatedAt, status: input.status },
	});
	if (auditResult.error) console.error('Could not write audit log:', auditResult.error.message);
}
