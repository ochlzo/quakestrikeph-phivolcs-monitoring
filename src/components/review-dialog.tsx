import * as React from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReviewForm } from "@/components/review-form";
import type { EarthquakeMarker, ForecastCase } from "@/lib/portal-data";
import type { ReviewStatus } from "@/lib/reviews";

export function ReviewDialog({
  event,
  onOpenChange,
  onSaved,
}: {
  event: EarthquakeMarker | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (eventId: string, status: ReviewStatus) => void;
}) {
  const [item, setItem] = React.useState<ForecastCase | null>(null);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (!event) {
      setItem(null);
      setError("");
      return;
    }
    const controller = new AbortController();
    fetch(`/api/forecast-cases/${encodeURIComponent(event.id)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data as ForecastCase;
      })
      .then(setItem)
      .catch((reason) => {
        if (reason.name !== "AbortError")
          setError(reason.message || "Could not load review.");
      });
    return () => controller.abort();
  }, [event?.id]);
  React.useEffect(() => {
    if (!event) return;
    function closeOnEscape(keyEvent: KeyboardEvent) {
      if (keyEvent.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [event, onOpenChange]);

  if (!event) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-2 backdrop-blur-[2px]"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onOpenChange(false);
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-dialog-title"
        aria-describedby="review-dialog-description"
        className="relative max-h-[94svh] w-[min(96vw,1500px)] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl"
      >
        <h2 id="review-dialog-title" className="sr-only">
          Review forecast
        </h2>
        <p id="review-dialog-description" className="sr-only">
          Forecast discussion and PHIVOLCS review form.
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3 z-10 bg-background/90"
          aria-label="Close dialog"
          onClick={() => onOpenChange(false)}
        >
          <XIcon />
        </Button>
        <div className="grid h-[90svh] min-h-0 lg:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
          <iframe
            title={`Forecast discussion for ${event.location ?? event.id}`}
            src={`https://quakestrikeph.qzz.io/forecast?event=${encodeURIComponent(event.id)}&iframe=true`}
            className="h-full min-h-[45svh] w-full border-0 bg-background"
          />
          <div className="min-h-0 border-t bg-card lg:border-l lg:border-t-0">
            {error ? (
              <div role="alert" className="p-6 text-destructive">
                {error}
              </div>
            ) : item ? (
              <ReviewForm
                item={item}
                onSaved={(status) => onSaved(item.event.id, status)}
              />
            ) : (
              <div className="p-6 text-muted-foreground">Loading review…</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
