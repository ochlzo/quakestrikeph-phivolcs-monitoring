import assert from "node:assert/strict";
import test from "node:test";
import {
  canAttemptAlert,
  composeReviewedForecastEmail,
  pendingAlertLog,
  predictedMmiAtPin,
  reviewedAlertRecipients,
  sendBrevoBatch,
} from "./alerts.ts";
import type { EventRow, PredictionRow } from "./portal-data.ts";

const event: EventRow = {
  id: "event-1",
  "Date-Time": "19 July 2026 - 01:00 PM",
  Latitude: 0,
  Longitude: 0,
  Depth: 10,
  Magnitude: 4.5,
  Location: "<Glan & nearby>",
  event_time: "2026-07-19T05:00:00Z",
};

const forecast = {
  event_id: event.id,
  created_at: "2026-07-19T05:01:00Z",
  aftershock_msg: "There is a medium likelihood within 24 hours.",
  m5_plus_msg: "There is a low M5+ likelihood within 24 hours.",
  distance_msg: "The most likely zone is within 10 km.",
  max_magnitude_msg: "Estimated maximum magnitude is M4.2.",
} as PredictionRow;

test("allows new and failed alerts to be attempted", () => {
  assert.equal(canAttemptAlert("NOT_SENT"), true);
  assert.equal(canAttemptAlert("FAILED"), true);
  assert.equal(canAttemptAlert("SENDING"), false);
  assert.equal(canAttemptAlert("SENT"), false);
});

test("filters near-pin recipients at MMI III and deduplicates email addresses", () => {
  const nearPin = 86 / 111.195;
  const farPin = 100 / 111.195;
  assert.ok(predictedMmiAtPin(event, nearPin, 0)! >= 3);
  assert.ok(predictedMmiAtPin(event, farPin, 0)! < 3);
  assert.equal(
    predictedMmiAtPin(event, nearPin, 0),
    predictedMmiAtPin({ ...event, Magnitude: 5 }, nearPin, 0),
  );

  assert.deepEqual(
    reviewedAlertRecipients(
      [
        {
          puserId: 1,
          email: "all@example.com",
          nearPinsOnly: false,
          pinLatitude: null,
          pinLongitude: null,
        },
        {
          puserId: 2,
          email: "near@example.com",
          nearPinsOnly: true,
          pinLatitude: nearPin,
          pinLongitude: 0,
        },
        {
          puserId: 3,
          email: "near@example.com",
          nearPinsOnly: true,
          pinLatitude: 0.5,
          pinLongitude: 0,
        },
        {
          puserId: 4,
          email: "far@example.com",
          nearPinsOnly: true,
          pinLatitude: farPin,
          pinLongitude: 0,
        },
        {
          puserId: 5,
          email: "none@example.com",
          nearPinsOnly: true,
          pinLatitude: null,
          pinLongitude: null,
        },
      ],
      event,
      3,
    ),
    [
      { email: "all@example.com", puser_ids: [1], message_id: null },
      { email: "near@example.com", puser_ids: [2, 3], message_id: null },
    ],
  );
});

test("composes reviewed content and sends private Brevo message versions", async () => {
  const message = composeReviewedForecastEmail(
    event,
    forecast,
    "Continue monitoring.",
  );
  assert.match(message.subject, /^PHIVOLCS-reviewed/);
  assert.match(message.text_content, /Continue monitoring\./);
  assert.match(message.html_content, /&lt;Glan &amp; nearby&gt;/);

  const log = pendingAlertLog(
    [
      { email: "one@example.com", puser_ids: [1], message_id: null },
      { email: "two@example.com", puser_ids: [2], message_id: null },
    ],
    message,
  );
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({ messageIds: ["message-1", "message-2"] }),
      {
        status: 201,
        headers: { "content-type": "application/json" },
      },
    );
  };
  try {
    assert.deepEqual(
      await sendBrevoBatch("12345678-1234-4234-8234-123456789abc", log, {
        apiKey: "secret",
        senderEmail: "alerts@quakestrikeph.qzz.io",
        senderName: "QuakeStrike PH",
      }),
      ["message-1", "message-2"],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(requestBody.headers, {
    idempotencyKey: "12345678-1234-4234-8234-123456789abc",
  });
  assert.equal((requestBody.messageVersions as unknown[]).length, 2);
});
