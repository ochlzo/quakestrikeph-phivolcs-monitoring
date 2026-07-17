import type { APIRoute } from 'astro';
import { getForecastCase } from '@/lib/portal-data';

export const GET: APIRoute = async ({ params }) => {
  try {
    const item = params.eventId ? await getForecastCase(params.eventId) : null;
    return item
      ? Response.json(item, { headers: { 'Cache-Control': 'no-store' } })
      : Response.json(
          { error: 'Forecast not found.' },
          { status: 404, headers: { 'Cache-Control': 'no-store' } },
        );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not load forecast.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
};
