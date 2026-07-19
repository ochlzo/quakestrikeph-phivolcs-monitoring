import type { EventRow, PredictionRow } from "./portal-data";

export const ALERT_STATUSES = [
  "NOT_SENT",
  "SENDING",
  "SENT",
  "FAILED",
] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export type AlertRecipient = {
  email: string;
  puser_ids: number[];
  message_id: string | null;
};

export type AlertCandidateRow = {
  puserId: number;
  email: string | null;
  nearPinsOnly: boolean;
  pinLatitude: number | null;
  pinLongitude: number | null;
};

export type ForecastAlertMessage = {
  subject: string;
  text_content: string;
  html_content: string;
};

export type ForecastAlertLog = {
  status: "sending" | "sent" | "failed";
  total_sent: number;
  recipients: AlertRecipient[];
  message: ForecastAlertMessage;
  error: string | null;
};

export type BrevoConfig = {
  apiKey: string;
  senderEmail: string;
  senderName: string;
  timeoutMs?: number;
};

export function canAttemptAlert(status: AlertStatus) {
  return status === "NOT_SENT" || status === "FAILED";
}

const BREVO_EMAIL_URL = "https://api.brevo.com/v3/smtp/email";
const MAX_BATCH_RECIPIENTS = 2000;
const EARTH_RADIUS_KM = 6371.0088;
const ALLEN_MIN_MAGNITUDE = 5;
const ALLEN_MAX_MAGNITUDE = 7.9;
const ALLEN_MAX_DISTANCE_KM = 300;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const coordinates = [lat1, lon1, lat2, lon2].map(Number);
  if (!coordinates.every(Number.isFinite))
    throw new Error("Coordinates must be finite numbers.");
  [lat1, lon1, lat2, lon2] = coordinates;
  if (Math.abs(lat1) > 90 || Math.abs(lat2) > 90)
    throw new Error("Latitude must be between -90 and 90 degrees.");
  if (Math.abs(lon1) > 180 || Math.abs(lon2) > 180)
    throw new Error("Longitude must be between -180 and 180 degrees.");

  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const [lat1Rad, lon1Rad, lat2Rad, lon2Rad] = coordinates.map(radians);
  const latitudeDelta = lat2Rad - lat1Rad;
  const longitudeDelta = lon2Rad - lon1Rad;
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(longitudeDelta / 2) ** 2;
  return (
    2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))))
  );
}

export function predictedMmiAtPin(
  event: EventRow,
  pinLatitude: number,
  pinLongitude: number,
) {
  const magnitude = Number(event.Magnitude);
  const depthKm = Number(event.Depth);
  if (!Number.isFinite(magnitude) || !Number.isFinite(depthKm) || depthKm < 0)
    throw new Error(
      "Event magnitude and depth must be finite; depth cannot be negative.",
    );

  const epicentralDistanceKm = haversineKm(
    event.Latitude,
    event.Longitude,
    pinLatitude,
    pinLongitude,
  );
  const hypocentralDistanceKm = Math.hypot(epicentralDistanceKm, depthKm);
  if (hypocentralDistanceKm > ALLEN_MAX_DISTANCE_KM) return null;

  const effectiveMagnitude = Math.min(
    ALLEN_MAX_MAGNITUDE,
    Math.max(ALLEN_MIN_MAGNITUDE, magnitude),
  );
  const nearSourceDistance = -0.209 + 2.042 * Math.exp(effectiveMagnitude - 5);
  let intensity =
    2.085 +
    1.428 * effectiveMagnitude -
    1.402 * Math.log(Math.hypot(hypocentralDistanceKm, nearSourceDistance));
  if (hypocentralDistanceKm > 50)
    intensity += 0.078 * Math.log(hypocentralDistanceKm / 50);
  return intensity;
}

export function reviewedAlertRecipients(
  rows: AlertCandidateRow[],
  event: EventRow,
  minimumMmi: number,
): AlertRecipient[] {
  const users = new Map<
    number,
    {
      email: string | null;
      nearPinsOnly: boolean;
      pins: Array<[number, number]>;
    }
  >();
  for (const row of rows) {
    const user = users.get(row.puserId) ?? {
      email: row.email,
      nearPinsOnly: row.nearPinsOnly,
      pins: [],
    };
    users.set(row.puserId, user);
    if (row.pinLatitude === null || row.pinLongitude === null) continue;
    try {
      haversineKm(
        event.Latitude,
        event.Longitude,
        row.pinLatitude,
        row.pinLongitude,
      );
      user.pins.push([row.pinLatitude, row.pinLongitude]);
    } catch {
      // Invalid saved pins do not qualify a near-pins-only recipient.
    }
  }

  const grouped = new Map<string, Set<number>>();
  for (const [puserId, user] of users) {
    const email = user.email?.trim().toLowerCase() ?? "";
    if (!EMAIL_PATTERN.test(email)) continue;
    if (
      user.nearPinsOnly &&
      !user.pins.some((pin) => {
        const intensity = predictedMmiAtPin(event, ...pin);
        return intensity !== null && intensity >= minimumMmi;
      })
    )
      continue;
    const ids = grouped.get(email) ?? new Set<number>();
    ids.add(puserId);
    grouped.set(email, ids);
  }

  return [...grouped]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([email, ids]) => ({
      email,
      puser_ids: [...ids].sort((left, right) => left - right),
      message_id: null,
    }));
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
}

export function composeReviewedForecastEmail(
  event: EventRow,
  forecast: PredictionRow,
  reviewText: string,
): ForecastAlertMessage {
  const location = (event.Location ?? "Unknown location")
    .replace(/\s+/g, " ")
    .trim();
  const originTime = event["Date-Time"].replace(/\s+/g, " ").trim();
  const magnitude = Number(event.Magnitude);
  const forecastLines = [
    forecast.aftershock_msg,
    forecast.m5_plus_msg,
    forecast.distance_msg,
    forecast.max_magnitude_msg,
  ].filter((line): line is string => Boolean(line?.trim()));
  const disclaimer =
    "This alert contains a human-reviewed probabilistic QuakeStrike PH model forecast. It does not state that an earthquake or aftershock will occur. Follow official PHIVOLCS bulletins and guidance.";
  const subject = `PHIVOLCS-reviewed QuakeStrike PH 24-hour forecast — M${magnitude.toFixed(1)} ${location}`;
  const textContent = [
    "PHIVOLCS-REVIEWED FORECAST",
    `Earthquake: M${magnitude.toFixed(1)} — ${location}`,
    `Origin time: ${originTime}`,
    `Coordinates: ${event.Latitude.toFixed(2)}, ${event.Longitude.toFixed(2)}`,
    `Depth: ${Number(event.Depth).toFixed(1)} km`,
    "",
    "PHIVOLCS review:",
    reviewText,
    "",
    "24-hour forecast:",
    ...forecastLines.map((line) => `- ${line}`),
    "",
    disclaimer,
  ].join("\n");
  const htmlContent = [
    "<!doctype html><html><body>",
    "<h1>PHIVOLCS-reviewed 24-hour forecast</h1>",
    `<p><strong>Earthquake:</strong> M${magnitude.toFixed(1)} — ${escapeHtml(location)}</p>`,
    `<p><strong>Origin time:</strong> ${escapeHtml(originTime)}<br>`,
    `<strong>Coordinates:</strong> ${event.Latitude.toFixed(2)}, ${event.Longitude.toFixed(2)}<br>`,
    `<strong>Depth:</strong> ${Number(event.Depth).toFixed(1)} km</p>`,
    "<h2>PHIVOLCS review</h2>",
    `<p>${escapeHtml(reviewText).replaceAll("\n", "<br>")}</p>`,
    "<h2>24-hour forecast</h2><ul>",
    ...forecastLines.map((line) => `<li>${escapeHtml(line)}</li>`),
    "</ul>",
    `<p><small>${escapeHtml(disclaimer)}</small></p>`,
    "</body></html>",
  ].join("");
  return { subject, text_content: textContent, html_content: htmlContent };
}

export function pendingAlertLog(
  recipients: AlertRecipient[],
  message: ForecastAlertMessage,
): ForecastAlertLog {
  return { status: "sending", total_sent: 0, recipients, message, error: null };
}

export function sentAlertLog(
  log: ForecastAlertLog,
  messageIds: string[],
): ForecastAlertLog {
  return {
    ...log,
    status: "sent",
    total_sent: messageIds.length,
    recipients: log.recipients.map((recipient, index) => ({
      ...recipient,
      message_id: messageIds[index]!,
    })),
    error: null,
  };
}

export function failedAlertLog(
  log: ForecastAlertLog,
  error: unknown,
): ForecastAlertLog {
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return {
    ...log,
    status: "failed",
    total_sent: 0,
    error: message.replace(/\s+/g, " ").slice(0, 2000),
  };
}

export async function sendBrevoBatch(
  alertId: string,
  log: ForecastAlertLog,
  config: BrevoConfig,
) {
  if (!log.recipients.length)
    throw new Error("No eligible alert recipients were found.");
  if (log.recipients.length > MAX_BATCH_RECIPIENTS)
    throw new Error(
      `Brevo supports at most ${MAX_BATCH_RECIPIENTS} recipients per alert.`,
    );

  const response = await fetch(BREVO_EMAIL_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": config.apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { email: config.senderEmail, name: config.senderName },
      subject: log.message.subject,
      textContent: log.message.text_content,
      htmlContent: log.message.html_content,
      headers: { idempotencyKey: alertId },
      messageVersions: log.recipients.map((recipient) => ({
        to: [{ email: recipient.email }],
      })),
    }),
    signal: AbortSignal.timeout(config.timeoutMs ?? 30_000),
  });
  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 500);
    throw new Error(
      `Brevo returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
    );
  }
  const payload = (await response.json()) as { messageIds?: unknown };
  if (
    !Array.isArray(payload.messageIds) ||
    payload.messageIds.length !== log.recipients.length
  )
    throw new Error("Brevo message IDs did not match the recipient count.");
  return payload.messageIds.map(String);
}
