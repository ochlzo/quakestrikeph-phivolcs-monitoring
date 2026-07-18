import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  REVIEW_STATUSES,
  REVIEW_STATUS_LABELS,
  REVIEW_TEMPLATES,
  type ReviewStatus,
} from '@/lib/reviews';
import type { ForecastCase } from '@/lib/portal-data';

export function ReviewForm({
  item,
  onSaved,
}: {
  item: ForecastCase;
  onSaved?: (status: ReviewStatus) => void;
}) {
  const [status, setStatus] = React.useState<ReviewStatus>(item.review?.status ?? 'PENDING_REVIEW');
  const [reviewText, setReviewText] = React.useState(item.review?.review_text ?? '');
  const [internalNote, setInternalNote] = React.useState(item.review?.internal_note ?? '');
  const [message, setMessage] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    const response = await fetch(`/api/reviews/${encodeURIComponent(item.event.id)}`, {
      method: 'POST',
      body: new FormData(event.currentTarget),
    });
    const data = (await response.json()) as {
      status?: ReviewStatus;
      error?: string;
    };
    if (response.ok && data.status) {
      setMessage('Review saved.');
      onSaved?.(data.status);
    } else setMessage(data.error ?? 'Could not save review.');
    setSaving(false);
  }

  return (
    <form className="flex h-full min-h-0 flex-col" onSubmit={submit}>
      <input type="hidden" name="forecast_created_at" value={item.forecast.created_at} />
      <div className="border-b p-5 pr-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          PHIVOLCS review
        </p>
        <h2 className="text-lg font-semibold">Review forecast</h2>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        <div className="space-y-1.5">
          <Label htmlFor={`review-status-${item.event.id}`}>Review status</Label>
          <select
            id={`review-status-${item.event.id}`}
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as ReviewStatus)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {REVIEW_STATUSES.map((value) => (
              <option value={value} key={value}>
                {REVIEW_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`review-template-${item.event.id}`}>Assessment template</Label>
          <select
            id={`review-template-${item.event.id}`}
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) setReviewText(event.target.value);
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select editable text…</option>
            {REVIEW_TEMPLATES.map((template) => (
              <option value={template.text} key={template.label}>
                {template.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`review-text-${item.event.id}`}>Review text</Label>
          <Textarea
            id={`review-text-${item.event.id}`}
            name="review_text"
            rows={8}
            maxLength={5000}
            value={reviewText}
            onChange={(event) => setReviewText(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`internal-note-${item.event.id}`}>Internal note</Label>
          <Textarea
            id={`internal-note-${item.event.id}`}
            name="internal_note"
            rows={4}
            maxLength={5000}
            value={internalNote}
            onChange={(event) => setInternalNote(event.target.value)}
          />
        </div>
        {message ? (
          <p role="status" className="rounded-md bg-muted p-3 text-sm">
            {message}
          </p>
        ) : null}
      </div>
      <div className="border-t p-4">
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? 'Saving review…' : 'Save review'}
        </Button>
      </div>
    </form>
  );
}
