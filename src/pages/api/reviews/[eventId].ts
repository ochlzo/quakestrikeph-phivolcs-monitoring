import type { APIRoute } from 'astro';
import { saveForecastReview } from '@/lib/portal-data';
import { parseReviewInput } from '@/lib/reviews';

export const POST: APIRoute = async ({ params, request, locals, url }) => {
  try {
    if (!params.eventId) throw new Error('Event ID is required.');
    const form = await request.formData();
    const revision = form.get('forecast_created_at');
    if (typeof revision !== 'string' || !revision)
      throw new Error('Forecast revision is required.');
    const input = parseReviewInput(form);
    const review = await saveForecastReview(
      params.eventId,
      revision,
      locals.user.email,
      input,
      url.pathname,
    );
    return Response.json(
      { ok: true, status: review.status, alertStatus: review.alert_status },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Could not save review.',
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
};
