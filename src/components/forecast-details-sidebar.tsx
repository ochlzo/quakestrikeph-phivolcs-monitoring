import * as React from 'react';
import { AlertCircleIcon, XIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { EarthquakeMarker, ForecastCase } from '@/lib/portal-data';
import { REVIEW_STATUS_LABELS, type ReviewStatus } from '@/lib/reviews';

const percent = (value: number | null) =>
  value === null
    ? 'Unavailable'
    : new Intl.NumberFormat('en-PH', { style: 'percent', maximumFractionDigits: 1 }).format(value);

export function ForecastDetailsSidebar({
  event,
  status,
  onClose,
  onReview,
}: {
  event: EarthquakeMarker;
  status: ReviewStatus;
  onClose: () => void;
  onReview: () => void;
}) {
  const [item, setItem] = React.useState<ForecastCase | null>(null);
  const [error, setError] = React.useState('');
  const [retry, setRetry] = React.useState(0);
  React.useEffect(() => {
    const controller = new AbortController();
    setItem(null);
    setError('');
    fetch(`/api/forecast-cases/${encodeURIComponent(event.id)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data as ForecastCase;
      })
      .then(setItem)
      .catch((reason) => {
        if (reason.name !== 'AbortError') setError(reason.message || 'Could not load forecast.');
      });
    return () => controller.abort();
  }, [event.id, retry]);

  return (
    <aside
      aria-label="Forecast details"
      className="flex h-full w-full shrink-0 flex-col border-r bg-sidebar md:w-80"
    >
      <header className="flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Forecast details
          </p>
          <h2 className="truncate font-semibold">{event.location ?? 'Unknown location'}</h2>
          <p className="text-xs text-muted-foreground">
            M{event.magnitude.toFixed(1)} · {event.date}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close forecast details" onClick={onClose}>
          <XIcon />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <div className="space-y-3 p-4 text-sm">
            <AlertCircleIcon className="text-destructive" />
            <p>{error}</p>
            <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>
              Try again
            </Button>
          </div>
        ) : !item ? (
          <div className="p-4 text-sm text-muted-foreground">Loading forecast details…</div>
        ) : (
          <>
            <div className="border-b p-4">
              <Badge className="border-primary/20 bg-accent text-primary">
                {REVIEW_STATUS_LABELS[status]}
              </Badge>
            </div>
            {[
              [
                'Aftershock within 24 hours',
                item.forecast.aftershock_24h,
                item.forecast.aftershock_24h_likelihood_level,
                item.forecast.aftershock_msg,
              ],
              [
                'Magnitude 5+ within 24 hours',
                item.forecast.m5_plus_aftershock,
                item.forecast.m5_plus_likelihood_level,
                item.forecast.m5_plus_msg,
              ],
            ].map(([label, value, level, message]) => (
              <section key={String(label)} className="space-y-2 border-b p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <div className="flex items-center justify-between">
                  <Badge>{String(level ?? 'No label')}</Badge>
                  <strong className="text-lg">{percent(value as number | null)}</strong>
                </div>
                {message ? (
                  <p className="text-sm text-muted-foreground">{String(message)}</p>
                ) : null}
              </section>
            ))}
            <section className="border-b p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Estimated strongest aftershock
              </p>
              <strong className="mt-1 block text-xl">
                {item.forecast.est_max_aftershock === null
                  ? 'Unavailable'
                  : `M${item.forecast.est_max_aftershock.toFixed(1)}`}
              </strong>
              {item.forecast.max_magnitude_msg ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.forecast.max_magnitude_msg}
                </p>
              ) : null}
            </section>
            <section className="space-y-2 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Distance bands
              </p>
              {[
                ['Within 10 km', item.forecast.within_10km],
                ['10–25 km', item.forecast.between_10_25km],
                ['25–50 km', item.forecast.between_25_50km],
                ['Beyond 50 km', item.forecast.beyond_50km],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between text-sm">
                  <span>{label}</span>
                  <strong>{percent(value as number | null)}</strong>
                </div>
              ))}
              {item.forecast.distance_msg ? (
                <p className="pt-2 text-sm text-muted-foreground">{item.forecast.distance_msg}</p>
              ) : null}
            </section>
          </>
        )}
      </div>
      <footer className="space-y-2 border-t p-4">
        <Button className="w-full" onClick={onReview}>
          Review forecast
        </Button>
        {item ? (
          <p className="text-center text-[11px] text-muted-foreground">
            Generated{' '}
            {new Intl.DateTimeFormat('en-PH', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Asia/Manila',
            }).format(new Date(item.forecast.created_at))}{' '}
            PHT
          </p>
        ) : null}
      </footer>
    </aside>
  );
}
