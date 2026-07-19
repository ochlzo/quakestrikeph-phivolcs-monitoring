import { randomUUID } from "node:crypto";
import {
  canAttemptAlert,
  composeReviewedForecastEmail,
  failedAlertLog,
  pendingAlertLog,
  reviewedAlertRecipients,
  sendBrevoBatch,
  sentAlertLog,
  type AlertCandidateRow,
  type AlertStatus,
  type BrevoConfig,
  type ForecastAlertLog,
} from "./alerts";
import { ensureOperatorId, getForecastCase } from "./portal-data";
import { getSupabaseAdmin } from "./supabase-server";

type AlertPreferences = {
  PUser_id: number;
  auth_user_id: string;
  Email: string | null;
  near_pins_only: boolean;
};

type SavedPin = {
  auth_user_id: string;
  latitude: number | null;
  longitude: number | null;
};

type StoredAlertReview = {
  id: number;
  status: string;
  alert_status: AlertStatus;
  alert_id: string | null;
  alert_log: ForecastAlertLog | null;
};

export type ForecastAlertConfig = BrevoConfig & { minimumMmi: number };

function requireData<T>(
  data: T | null,
  error: { message: string } | null,
  action: string,
): T {
  if (error) throw new Error(`${action}: ${error.message}`);
  if (data === null) throw new Error(`${action}: no data returned`);
  return data;
}

async function writeAlertAudit(
  userEmail: string,
  path: string,
  metadata: Record<string, unknown>,
) {
  const result = await getSupabaseAdmin().from("audit_logs").insert({
    user_email: userEmail,
    path,
    method: "POST",
    metadata,
  });
  if (result.error)
    console.error("Could not write alert audit log:", result.error.message);
}

async function getAlertCandidates(): Promise<AlertCandidateRow[]> {
  const supabase = getSupabaseAdmin();
  const usersResult = await supabase
    .from("PubUser")
    .select("PUser_id, auth_user_id, Email, near_pins_only")
    .eq("alerts_on", true);
  const users = requireData(
    usersResult.data as AlertPreferences[] | null,
    usersResult.error,
    "Could not load alert recipients",
  );
  if (!users.length) return [];

  const pinsResult = await supabase
    .from("SavedPins")
    .select("auth_user_id, latitude, longitude")
    .in(
      "auth_user_id",
      users.map((user) => user.auth_user_id),
    );
  const pins = requireData(
    pinsResult.data as SavedPin[] | null,
    pinsResult.error,
    "Could not load recipient pins",
  );
  const pinsByUser = new Map<string, SavedPin[]>();
  for (const pin of pins)
    pinsByUser.set(pin.auth_user_id, [
      ...(pinsByUser.get(pin.auth_user_id) ?? []),
      pin,
    ]);

  return users.flatMap((user) => {
    const userPins = pinsByUser.get(user.auth_user_id);
    if (!userPins?.length)
      return [
        {
          puserId: user.PUser_id,
          email: user.Email,
          nearPinsOnly: user.near_pins_only,
          pinLatitude: null,
          pinLongitude: null,
        },
      ];
    return userPins.map((pin) => ({
      puserId: user.PUser_id,
      email: user.Email,
      nearPinsOnly: user.near_pins_only,
      pinLatitude: pin.latitude,
      pinLongitude: pin.longitude,
    }));
  });
}

export async function sendForecastAlert(
  eventId: string,
  operatorEmail: string,
  path: string,
  config: ForecastAlertConfig,
) {
  const item = await getForecastCase(eventId);
  if (!item) throw new Error("The current forecast could not be found.");
  if (!item.review || item.review.status !== "REVIEWED_FOR_ALERT")
    throw new Error(
      "Save the review as Reviewed — prepare alert before sending.",
    );

  const supabase = getSupabaseAdmin();
  const storedResult = await supabase
    .from("forecast_reviews")
    .select("id, status, alert_status, alert_id, alert_log")
    .eq("id", item.review.id)
    .single();
  const stored = requireData(
    storedResult.data as StoredAlertReview | null,
    storedResult.error,
    "Could not load alert state",
  );
  if (stored.alert_status === "SENT")
    throw new Error("This forecast alert was already sent.");
  if (!canAttemptAlert(stored.alert_status))
    throw new Error(
      "This alert was already attempted. Check the operator logs before continuing.",
    );

  const retrying = stored.alert_status === "FAILED";
  const operatorId = await ensureOperatorId(operatorEmail);
  let alertId: string;
  let alertLog: ForecastAlertLog;
  if (retrying) {
    if (!stored.alert_id || !stored.alert_log)
      throw new Error(
        "The failed alert snapshot is unavailable. Check the operator logs.",
      );
    alertId = stored.alert_id;
    alertLog = pendingAlertLog(
      stored.alert_log.recipients,
      stored.alert_log.message,
    );
  } else {
    const recipients = reviewedAlertRecipients(
      await getAlertCandidates(),
      item.event,
      config.minimumMmi,
    );
    if (!recipients.length) {
      await writeAlertAudit(operatorEmail, path, {
        action: "send_forecast_alert_failed",
        event_id: eventId,
        forecast_created_at: item.forecast.created_at,
        error: "No eligible alert recipients were found.",
      });
      throw new Error("No eligible alert recipients were found.");
    }
    alertId = randomUUID();
    alertLog = pendingAlertLog(
      recipients,
      composeReviewedForecastEmail(
        item.event,
        item.forecast,
        item.review.review_text,
      ),
    );
  }

  const recipients = alertLog.recipients;
  const claimedAt = new Date().toISOString();
  const claimResult = await supabase
    .from("forecast_reviews")
    .update({
      alert_status: "SENDING",
      alert_id: alertId,
      alert_log: alertLog,
      updated_at: claimedAt,
    })
    .eq("id", stored.id)
    .eq("status", "REVIEWED_FOR_ALERT")
    .eq("alert_status", stored.alert_status)
    .select("id")
    .maybeSingle();
  if (claimResult.error)
    throw new Error(
      `Could not reserve alert delivery: ${claimResult.error.message}`,
    );
  if (!claimResult.data)
    throw new Error("Alert state changed. Reload before sending.");

  let messageIds: string[];
  try {
    messageIds = await sendBrevoBatch(alertId, alertLog, config);
  } catch (error) {
    const failedLog = failedAlertLog(alertLog, error);
    const failedResult = await supabase
      .from("forecast_reviews")
      .update({
        alert_status: "FAILED",
        alert_log: failedLog,
        updated_at: new Date().toISOString(),
      })
      .eq("id", stored.id)
      .eq("alert_id", alertId)
      .eq("alert_status", "SENDING");
    if (failedResult.error)
      console.error(
        "Could not record failed alert:",
        failedResult.error.message,
      );
    await writeAlertAudit(operatorEmail, path, {
      action: "send_forecast_alert_failed",
      event_id: eventId,
      forecast_created_at: item.forecast.created_at,
      alert_id: alertId,
      recipient_count: recipients.length,
      retry: retrying,
      error: failedLog.error,
    });
    if (failedResult.error)
      throw new Error(
        "Alert delivery failed, but its failed state could not be recorded.",
      );
    return {
      alertStatus: "FAILED" as const,
      error: error instanceof Error ? error.message : "Could not send alert.",
    };
  }

  const sentAt = new Date().toISOString();
  const sentLog = sentAlertLog(alertLog, messageIds);
  const sentResult = await supabase
    .from("forecast_reviews")
    .update({
      alert_status: "SENT",
      alert_log: sentLog,
      alert_sent_at: sentAt,
      alert_sent_by_operator_id: operatorId,
      updated_at: sentAt,
    })
    .eq("id", stored.id)
    .eq("alert_id", alertId)
    .eq("alert_status", "SENDING")
    .select("id")
    .single();
  if (sentResult.error)
    throw new Error(
      `Brevo accepted the alert but its final state could not be saved: ${sentResult.error.message}`,
    );

  await writeAlertAudit(operatorEmail, path, {
    action: "send_forecast_alert",
    event_id: eventId,
    forecast_created_at: item.forecast.created_at,
    review_id: stored.id,
    alert_id: alertId,
    provider: "brevo",
    recipient_count: recipients.length,
    retry: retrying,
    recipient_puser_ids: recipients.flatMap((recipient) => recipient.puser_ids),
    provider_message_ids: messageIds,
  });
  return { alertStatus: "SENT" as const, sentAt, totalSent: messageIds.length };
}
