import type { APIRoute } from "astro";
import {
  BREVO_API_KEY,
  BREVO_SENDER_EMAIL,
  BREVO_SENDER_NAME,
  EMAIL_ALERTS_ENABLED,
  PIN_ALERT_MIN_MMI,
} from "astro:env/server";
import { sendForecastAlert } from "@/lib/alert-delivery";

export const POST: APIRoute = async ({ params, locals, url }) => {
  try {
    if (!params.eventId) throw new Error("Event ID is required.");
    if (!EMAIL_ALERTS_ENABLED) throw new Error("Email alerts are disabled.");
    if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL)
      throw new Error("Brevo email settings are incomplete.");
    if (
      !Number.isFinite(PIN_ALERT_MIN_MMI) ||
      PIN_ALERT_MIN_MMI < 1 ||
      PIN_ALERT_MIN_MMI > 12
    )
      throw new Error("PIN_ALERT_MIN_MMI must be between 1 and 12.");

    const result = await sendForecastAlert(
      params.eventId,
      locals.user.email,
      url.pathname,
      {
        apiKey: BREVO_API_KEY,
        senderEmail: BREVO_SENDER_EMAIL,
        senderName: BREVO_SENDER_NAME,
        minimumMmi: PIN_ALERT_MIN_MMI,
      },
    );
    return Response.json(result, {
      status: result.alertStatus === "FAILED" ? 502 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not send forecast alert.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
};
