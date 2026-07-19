import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { canAttemptAlert, type AlertStatus } from "@/lib/alerts";
import {
  REVIEW_STATUSES,
  REVIEW_STATUS_LABELS,
  REVIEW_TEMPLATES,
  type ReviewStatus,
} from "@/lib/reviews";
import type { ForecastCase } from "@/lib/portal-data";

export function ReviewForm({
  item,
  onSaved,
}: {
  item: ForecastCase;
  onSaved?: (status: ReviewStatus) => void;
}) {
  const [status, setStatus] = React.useState<ReviewStatus>(
    item.review?.status ?? "PENDING_REVIEW",
  );
  const [savedStatus, setSavedStatus] = React.useState<ReviewStatus>(
    item.review?.status ?? "PENDING_REVIEW",
  );
  const [alertStatus, setAlertStatus] = React.useState<AlertStatus>(
    item.review?.alert_status ?? "NOT_SENT",
  );
  const [reviewText, setReviewText] = React.useState(
    item.review?.review_text ?? "",
  );
  const [internalNote, setInternalNote] = React.useState(
    item.review?.internal_note ?? "",
  );
  const [savedReviewText, setSavedReviewText] = React.useState(
    item.review?.review_text ?? "",
  );
  const [savedInternalNote, setSavedInternalNote] = React.useState(
    item.review?.internal_note ?? "",
  );
  const [message, setMessage] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const locked = alertStatus === "SENT";
  const retrying = alertStatus === "FAILED";
  const canSend =
    savedStatus === "REVIEWED_FOR_ALERT" &&
    status === savedStatus &&
    reviewText === savedReviewText &&
    internalNote === savedInternalNote &&
    canAttemptAlert(alertStatus);

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch(
      `/api/reviews/${encodeURIComponent(item.event.id)}`,
      {
        method: "POST",
        body: new FormData(event.currentTarget),
      },
    );
    const data = (await response.json()) as {
      status?: ReviewStatus;
      alertStatus?: AlertStatus;
      error?: string;
    };
    if (response.ok && data.status) {
      setStatus(data.status);
      setSavedStatus(data.status);
      setSavedReviewText(reviewText);
      setSavedInternalNote(internalNote);
      if (data.alertStatus) setAlertStatus(data.alertStatus);
      setMessage(locked ? "Internal note saved." : "Review saved.");
      onSaved?.(data.status);
    } else setMessage(data.error ?? "Could not save review.");
    setSaving(false);
  }

  async function sendAlert() {
    if (
      !window.confirm(
        retrying
          ? "Retry this failed forecast alert using the original recipient and message snapshot?"
          : "Send this reviewed forecast alert to all eligible recipients?",
      )
    )
      return;
    setSending(true);
    setMessage("");
    const response = await fetch(
      `/api/alerts/${encodeURIComponent(item.event.id)}`,
      {
        method: "POST",
      },
    );
    const data = (await response.json()) as {
      alertStatus?: AlertStatus;
      totalSent?: number;
      error?: string;
    };
    if (response.ok && data.alertStatus === "SENT") {
      setAlertStatus("SENT");
      setMessage(
        `Alert sent to ${data.totalSent ?? 0} recipient${data.totalSent === 1 ? "" : "s"}.`,
      );
    } else {
      if (data.alertStatus) setAlertStatus(data.alertStatus);
      setMessage(data.error ?? "Could not send alert.");
    }
    setSending(false);
  }

  return (
    <form className="flex h-full min-h-0 flex-col" onSubmit={submit}>
      <input
        type="hidden"
        name="forecast_created_at"
        value={item.forecast.created_at}
      />
      <div className="border-b p-5 pr-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          PHIVOLCS review
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Review forecast</h2>
          {locked ? (
            <Badge className="border-primary/20 bg-accent text-primary">
              Alert sent
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {locked ? (
          <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            This alert was sent. Only the internal note can be updated.
          </p>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor={`review-status-${item.event.id}`}>
            Review status
          </Label>
          <select
            id={`review-status-${item.event.id}`}
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as ReviewStatus)}
            disabled={locked || saving || sending}
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
          <Label htmlFor={`review-template-${item.event.id}`}>
            Assessment template
          </Label>
          <select
            id={`review-template-${item.event.id}`}
            defaultValue=""
            disabled={locked || saving || sending}
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
            disabled={locked || saving || sending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`internal-note-${item.event.id}`}>
            Internal note
          </Label>
          <Textarea
            id={`internal-note-${item.event.id}`}
            name="internal_note"
            rows={4}
            maxLength={5000}
            value={internalNote}
            onChange={(event) => setInternalNote(event.target.value)}
            disabled={saving || sending}
          />
        </div>
        {locked ? (
          <>
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="review_text" value={reviewText} />
          </>
        ) : null}
        {alertStatus === "SENDING" ? (
          <p className="rounded-md bg-muted p-3 text-sm">
            Alert delivery is in progress.
          </p>
        ) : null}
        {alertStatus === "FAILED" ? (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            Alert delivery failed. Correct the reported issue, then retry the
            original alert.
          </p>
        ) : null}
        {message ? (
          <p role="status" className="rounded-md bg-muted p-3 text-sm">
            {message}
          </p>
        ) : null}
      </div>
      <div className="space-y-2 border-t p-4">
        <Button type="submit" className="w-full" disabled={saving || sending}>
          {saving ? "Saving…" : locked ? "Save internal note" : "Save review"}
        </Button>
        {canSend ? (
          <Button
            type="button"
            className="w-full"
            onClick={sendAlert}
            disabled={saving || sending}
          >
            {sending
              ? retrying
                ? "Retrying alert…"
                : "Sending alert…"
              : retrying
                ? "Retry alert"
                : "Send alert"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
