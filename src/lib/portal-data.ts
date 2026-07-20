import type { ReviewInput, ReviewStatus } from './reviews';
import type { AlertStatus } from './alerts';
import { getSupabaseAdmin } from './supabase-server';

export type EventRow = {
  id: string;
  'Date-Time': string;
  Latitude: number;
  Longitude: number;
  Depth: number | string;
  Magnitude: number;
  Location: string | null;
  event_time: string | null;
};

export type PredictionRow = {
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
  aftershock_msg: string | null;
  m5_plus_msg: string | null;
  distance_msg: string | null;
  max_magnitude_msg: string | null;
};

export type ReviewRow = {
  id: number;
  event_id: string;
  forecast_created_at: string;
  status: ReviewStatus;
  review_text: string;
  internal_note: string;
  operator_id: number;
  reviewed_at: string | null;
  updated_at: string;
  alert_status: AlertStatus;
  alert_sent_at: string | null;
};

export type ForecastCase = {
  event: EventRow;
  forecast: PredictionRow;
  review: ReviewRow | null;
};

export type ForecastListRow = {
  event_id: string;
  event_date_time: string;
  latitude: number;
  longitude: number;
  depth: number | string;
  magnitude: number;
  location: string | null;
  event_time: string | null;
  created_at: string;
  aftershock_24h: number | null;
  review_status: ReviewStatus;
  alert_status: AlertStatus;
};

export type AuditLogRow = {
  id: number;
  user_email: string;
  operator_display_name: string | null;
  path: string;
  method: string;
  created_at: string;
  metadata: Record<string, unknown>;
  action: string;
};

export type PortalPage<T> = { rows: T[]; total: number };

export type EarthquakeMarker = {
  id: string;
  date: string;
  latitude: number;
  longitude: number;
  depth: number | string;
  magnitude: number;
  location: string | null;
  eventTime: string | null;
  hasForecast: boolean;
  aftershock24hLikelihoodLevel: string | null;
  m5PlusLikelihoodLevel: string | null;
  estimatedStrongestAftershock: number | null;
  reviewStatus: ReviewStatus | 'NO_FORECAST';
};

export type EarthquakeMarkerPage = {
  events: EarthquakeMarker[];
  nextOffset: number;
  hasMore: boolean;
  atLimit: boolean;
};

export type MagnitudeRange = { from: number; to?: number; upperExclusive?: boolean };

export type PlaybackScope = 'gk' | '100km' | 'all';
export type PlaybackCursor = { eventTime: string; eventId: string };
export type PlaybackPage = {
  status: 'pending' | 'current' | 'complete' | 'delayed';
  playbackScope: PlaybackScope;
  gardnerKnopoffRadiusKm: number;
  forecastStartedAt: string;
  forecastWindowEndsAt: string;
  observedThrough: string | null;
  events: Array<{
    id: string;
    dateTime: string;
    eventTime: string;
    latitude: number;
    longitude: number;
    depth: number | string;
    magnitude: number;
    distanceKm: number;
    withinGardnerKnopoffRadius: boolean;
  }>;
  nextCursor: PlaybackCursor | null;
  hasMore: boolean;
};

export type OperatorProfile = {
  id: number;
  email: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};

const PREDICTION_FIELDS = `
	event_id, created_at, aftershock_24h, m5_plus_aftershock,
	within_10km, between_10_25km, between_25_50km, beyond_50km,
	est_max_aftershock, aftershock_24h_likelihood_level, m5_plus_likelihood_level
	, aftershock_msg, m5_plus_msg, distance_msg, max_magnitude_msg
`;
const EVENT_FIELDS =
  'id, "Date-Time", "Latitude", "Longitude", "Depth", "Magnitude", "Location", event_time';
const REVIEW_FIELDS =
  'id, event_id, forecast_created_at, status, review_text, internal_note, operator_id, reviewed_at, updated_at, alert_status, alert_sent_at';
export const MAP_PAGE_SIZE = 50;
export const MAX_MAP_EVENTS = 2000;

function requireData<T>(data: T | null, error: { message: string } | null, action: string): T {
  if (error) throw new Error(`${action}: ${error.message}`);
  if (data === null) throw new Error(`${action}: no data returned`);
  return data;
}

function revisionKey(eventId: string, createdAt: string) {
  return `${eventId}:${new Date(createdAt).toISOString()}`;
}

function portalPage<T>(
  data: unknown,
  error: { message: string } | null,
  action: string,
): PortalPage<T> {
  const payload = requireData(data as { rows?: T[]; total?: number } | null, error, action);
  return {
    rows: Array.isArray(payload.rows) ? payload.rows : [],
    total: Number.isFinite(Number(payload.total)) ? Number(payload.total) : 0,
  };
}

export async function getForecastPage(options: {
  query?: string | null;
  reviewStatuses?: ReviewStatus[] | null;
  magnitudeRanges?: MagnitudeRange[] | null;
  depthFrom?: number | null;
  depthTo?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  aftershockLikelihoods?: string[] | null;
  m5Likelihoods?: string[] | null;
  minimumStrongest?: number | null;
  limit: number;
  offset: number;
}): Promise<PortalPage<ForecastListRow>> {
  const result = await getSupabaseAdmin().rpc('get_portal_forecast_page', {
    query_text: options.query?.trim() || null,
    review_statuses: options.reviewStatuses?.length ? options.reviewStatuses : null,
    magnitude_ranges: options.magnitudeRanges?.length ? options.magnitudeRanges : null,
    depth_from: options.depthFrom ?? null,
    depth_to: options.depthTo ?? null,
    date_from: options.dateFrom ?? null,
    date_to: options.dateTo ?? null,
    aftershock_24h_likelihoods: options.aftershockLikelihoods?.length
      ? options.aftershockLikelihoods
      : null,
    m5_plus_likelihoods: options.m5Likelihoods?.length ? options.m5Likelihoods : null,
    minimum_estimated_strongest_aftershock: options.minimumStrongest ?? null,
    result_limit: options.limit,
    result_offset: options.offset,
  });
  return portalPage<ForecastListRow>(result.data, result.error, 'Could not load forecasts');
}

export async function getForecastCase(eventId: string): Promise<ForecastCase | null> {
  const supabase = getSupabaseAdmin();
  const [eventResult, forecastResult] = await Promise.all([
    supabase
      .from('RawEarthquakeEvents')
      .select(EVENT_FIELDS)
      .eq('id', eventId)
      .in('source_status', ['CURRENT', 'HISTORICAL'])
      .maybeSingle(),
    supabase
      .from('SeisPredictions_v1')
      .select(PREDICTION_FIELDS)
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);
  if (eventResult.error) throw new Error(`Could not load event: ${eventResult.error.message}`);
  if (forecastResult.error)
    throw new Error(`Could not load forecast: ${forecastResult.error.message}`);
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

export async function getEarthquakeMarkerPage(
  options: {
    offset?: number;
    query?: string | null;
    magnitudeRanges?: MagnitudeRange[] | null;
    depthFrom?: number | null;
    depthTo?: number | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    aftershockLikelihoods?: string[];
    m5Likelihoods?: string[];
    minimumStrongest?: number | null;
    includeNoForecast?: boolean;
  } = {},
): Promise<EarthquakeMarkerPage> {
  const offset = Math.max(0, Math.min(Math.trunc(options.offset ?? 0), MAX_MAP_EVENTS));
  if (offset >= MAX_MAP_EVENTS)
    return { events: [], nextOffset: MAX_MAP_EVENTS, hasMore: false, atLimit: true };
  const supabase = getSupabaseAdmin();
  const pageSize = Math.min(MAP_PAGE_SIZE, MAX_MAP_EVENTS - offset);
  const result = await supabase.rpc('filter_earthquake_events', {
    query_text: options.query?.trim() || null,
    magnitude_ranges: options.magnitudeRanges ?? null,
    depth_from: options.depthFrom ?? null,
    depth_to: options.depthTo ?? null,
    date_from: options.dateFrom ?? null,
    date_to: options.dateTo ?? null,
    aftershock_24h_likelihoods: options.aftershockLikelihoods ?? ['low', 'medium', 'high'],
    m5_plus_likelihoods: options.m5Likelihoods ?? ['low', 'medium', 'high'],
    minimum_estimated_strongest_aftershock: options.minimumStrongest ?? null,
    include_no_forecast: options.includeNoForecast ?? true,
    result_limit: pageSize + 1,
    result_offset: offset,
  });
  const rows = requireData(
    result.data as Array<{
      id: string;
      'Date-Time': string;
      Latitude: number;
      Longitude: number;
      Depth: number | string;
      Magnitude: number;
      Location: string | null;
      event_time: string | null;
      has_forecast: boolean;
      aftershock_24h_likelihood_level: string | null;
      m5_plus_likelihood_level: string | null;
      est_max_aftershock: number | null;
    }> | null,
    result.error,
    'Could not load earthquake events',
  );
  const pageRows = rows.slice(0, pageSize);
  const forecastIds = pageRows.filter((row) => row.has_forecast).map((row) => row.id);
  const statusByEvent = new Map<string, ReviewStatus>();
  if (forecastIds.length) {
    const [forecastsResult, reviewsResult] = await Promise.all([
      supabase
        .from('SeisPredictions_v1')
        .select('event_id, created_at')
        .in('event_id', forecastIds),
      supabase
        .from('forecast_reviews')
        .select('event_id, forecast_created_at, status')
        .in('event_id', forecastIds),
    ]);
    const forecasts = requireData(
      forecastsResult.data as Array<{ event_id: string; created_at: string }> | null,
      forecastsResult.error,
      'Could not load forecast revisions',
    );
    const reviews = requireData(
      reviewsResult.data as Array<{
        event_id: string;
        forecast_created_at: string;
        status: ReviewStatus;
      }> | null,
      reviewsResult.error,
      'Could not load review statuses',
    );
    const currentRevision = new Map(
      forecasts.map((row) => [row.event_id, revisionKey(row.event_id, row.created_at)]),
    );
    for (const review of reviews)
      if (
        currentRevision.get(review.event_id) ===
        revisionKey(review.event_id, review.forecast_created_at)
      )
        statusByEvent.set(review.event_id, review.status);
  }
  const nextOffset = Math.min(offset + pageRows.length, MAX_MAP_EVENTS);
  return {
    events: pageRows.map((row) => ({
      id: row.id,
      date: row['Date-Time'],
      latitude: row.Latitude,
      longitude: row.Longitude,
      depth: row.Depth,
      magnitude: row.Magnitude,
      location: row.Location,
      eventTime: row.event_time,
      hasForecast: row.has_forecast,
      aftershock24hLikelihoodLevel: row.aftershock_24h_likelihood_level,
      m5PlusLikelihoodLevel: row.m5_plus_likelihood_level,
      estimatedStrongestAftershock: row.est_max_aftershock,
      reviewStatus: row.has_forecast
        ? (statusByEvent.get(row.id) ?? 'PENDING_REVIEW')
        : 'NO_FORECAST',
    })),
    nextOffset,
    hasMore: rows.length > pageRows.length && nextOffset < MAX_MAP_EVENTS,
    atLimit: nextOffset >= MAX_MAP_EVENTS,
  };
}

export async function getForecastPlaybackPage(
  eventId: string,
  cursor: PlaybackCursor | null = null,
  scope: PlaybackScope = 'gk',
  limit = 100,
): Promise<PlaybackPage | null> {
  const result = await getSupabaseAdmin().rpc('get_forecast_playback_page', {
    trigger_event_id: eventId,
    cursor_event_time: cursor?.eventTime ?? null,
    cursor_event_id: cursor?.eventId ?? null,
    result_limit: Math.max(1, Math.min(Math.trunc(limit), 100)),
    playback_scope: scope,
  });
  if (result.error) throw new Error(`Could not load forecast playback: ${result.error.message}`);
  if (!result.data) return null;
  const data = result.data as {
    status: PlaybackPage['status'];
    playback_scope: PlaybackScope;
    gk_radius_km: number;
    forecast_started_at: string;
    forecast_window_ends_at: string;
    observed_through: string | null;
    events: Array<{
      id: string;
      date_time: string;
      event_time: string;
      latitude: number;
      longitude: number;
      depth: number | string;
      magnitude: number;
      distance_km: number;
      within_gk_radius: boolean;
    }>;
    next_cursor: { event_time: string; event_id: string } | null;
    has_more: boolean;
  };
  return {
    status: data.status,
    playbackScope: data.playback_scope,
    gardnerKnopoffRadiusKm: data.gk_radius_km,
    forecastStartedAt: data.forecast_started_at,
    forecastWindowEndsAt: data.forecast_window_ends_at,
    observedThrough: data.observed_through,
    events: data.events.map((event) => ({
      id: event.id,
      dateTime: event.date_time,
      eventTime: event.event_time,
      latitude: event.latitude,
      longitude: event.longitude,
      depth: event.depth,
      magnitude: event.magnitude,
      distanceKm: event.distance_km,
      withinGardnerKnopoffRadius: event.within_gk_radius,
    })),
    nextCursor: data.next_cursor
      ? { eventTime: data.next_cursor.event_time, eventId: data.next_cursor.event_id }
      : null,
    hasMore: data.has_more,
  };
}

export async function getRawEventPage(options: {
  query?: string | null;
  magnitudeRanges?: MagnitudeRange[] | null;
  depthFrom?: number | null;
  depthTo?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit: number;
  offset: number;
}): Promise<PortalPage<EventRow>> {
  const result = await getSupabaseAdmin().rpc('get_portal_event_page', {
    query_text: options.query?.trim() || null,
    magnitude_ranges: options.magnitudeRanges?.length ? options.magnitudeRanges : null,
    depth_from: options.depthFrom ?? null,
    depth_to: options.depthTo ?? null,
    date_from: options.dateFrom ?? null,
    date_to: options.dateTo ?? null,
    result_limit: options.limit,
    result_offset: options.offset,
  });
  const page = portalPage<{
    id: string;
    date_time: string;
    latitude: number;
    longitude: number;
    depth: number | string;
    magnitude: number;
    location: string | null;
    event_time: string | null;
  }>(result.data, result.error, 'Could not load raw events');
  return {
    total: page.total,
    rows: page.rows.map((row) => ({
      id: row.id,
      'Date-Time': row.date_time,
      Latitude: row.latitude,
      Longitude: row.longitude,
      Depth: row.depth,
      Magnitude: row.magnitude,
      Location: row.location,
      event_time: row.event_time,
    })),
  };
}

export async function getAuditLogPage(options: {
  query?: string | null;
  actions?: string[] | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit: number;
  offset: number;
}): Promise<PortalPage<AuditLogRow> & { actions: string[] }> {
  const result = await getSupabaseAdmin().rpc('get_portal_audit_log_page', {
    query_text: options.query?.trim() || null,
    actions: options.actions?.length ? options.actions : null,
    date_from: options.dateFrom ?? null,
    date_to: options.dateTo ?? null,
    result_limit: options.limit,
    result_offset: options.offset,
  });
  const page = portalPage<AuditLogRow>(result.data, result.error, 'Could not load audit logs');
  const actions = (result.data as { actions?: unknown } | null)?.actions;
  return {
    ...page,
    actions: Array.isArray(actions)
      ? actions.filter((action): action is string => typeof action === 'string')
      : [],
  };
}

export async function getOperatorProfile(email: string): Promise<OperatorProfile | null> {
  const result = await getSupabaseAdmin()
    .from('operator_profiles')
    .select('id, email, display_name, created_at, updated_at')
    .eq('email', email)
    .maybeSingle();
  if (result.error?.code === 'PGRST205') return null;
  if (result.error) throw new Error(`Could not load operator profile: ${result.error.message}`);
  return result.data as OperatorProfile | null;
}

export async function saveOperatorProfile(
  email: string,
  displayName: string,
  path: string,
): Promise<OperatorProfile> {
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from('operator_profiles')
    .upsert({ email, display_name: displayName, updated_at: now }, { onConflict: 'email' })
    .select('id, email, display_name, created_at, updated_at')
    .single();
  const profile = requireData(
    result.data as OperatorProfile | null,
    result.error,
    'Could not save operator profile',
  );
  const audit = await supabase
    .from('audit_logs')
    .insert({
      user_email: email,
      path,
      method: 'POST',
      metadata: { action: 'update_operator_profile', changed_fields: ['display_name'] },
    });
  if (audit.error) console.error('Could not write profile audit log:', audit.error.message);
  return profile;
}

export async function ensureOperatorId(email: string) {
  const supabase = getSupabaseAdmin();
  const profileInsert = await supabase
    .from('operator_profiles')
    .upsert({ email }, { onConflict: 'email', ignoreDuplicates: true });
  if (profileInsert.error)
    throw new Error(`Could not ensure operator profile: ${profileInsert.error.message}`);
  const profileResult = await supabase
    .from('operator_profiles')
    .select('id')
    .eq('email', email)
    .single();
  return requireData(
    profileResult.data as { id: number } | null,
    profileResult.error,
    'Could not load operator profile',
  ).id;
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
  if (currentResult.error)
    throw new Error(`Could not verify forecast revision: ${currentResult.error.message}`);
  if (
    !currentResult.data ||
    revisionKey(eventId, currentResult.data.created_at) !== revisionKey(eventId, forecastCreatedAt)
  ) {
    throw new Error('This forecast was superseded. Reload and review the current forecast.');
  }

  const now = new Date().toISOString();
  const existingResult = await supabase
    .from('forecast_reviews')
    .select(REVIEW_FIELDS)
    .eq('event_id', eventId)
    .eq('forecast_created_at', forecastCreatedAt)
    .maybeSingle();
  if (existingResult.error)
    throw new Error(`Could not load review state: ${existingResult.error.message}`);

  let review: ReviewRow;
  let action = 'save_forecast_review';
  if ((existingResult.data as ReviewRow | null)?.alert_status === 'SENT') {
    const result = await supabase
      .from('forecast_reviews')
      .update({ internal_note: input.internalNote, updated_at: now })
      .eq('id', (existingResult.data as ReviewRow).id)
      .eq('alert_status', 'SENT')
      .select(REVIEW_FIELDS)
      .single();
    review = requireData(
      result.data as ReviewRow | null,
      result.error,
      'Could not save internal note',
    );
    action = 'update_sent_review_internal_note';
  } else {
    const operatorId = await ensureOperatorId(operatorEmail);
    const result = await supabase
      .from('forecast_reviews')
      .upsert(
        {
          event_id: eventId,
          forecast_created_at: forecastCreatedAt,
          status: input.status,
          review_text: input.reviewText,
          internal_note: input.internalNote,
          operator_id: operatorId,
          reviewed_at: input.status.startsWith('REVIEWED_') ? now : null,
          updated_at: now,
        },
        { onConflict: 'event_id,forecast_created_at' },
      )
      .select(REVIEW_FIELDS)
      .single();
    review = requireData(result.data as ReviewRow | null, result.error, 'Could not save review');
  }

  const auditResult = await supabase.from('audit_logs').insert({
    user_email: operatorEmail,
    path,
    method: 'POST',
    metadata: {
      action,
      event_id: eventId,
      forecast_created_at: forecastCreatedAt,
      status: review.status,
    },
  });
  if (auditResult.error) console.error('Could not write audit log:', auditResult.error.message);
  return review;
}
