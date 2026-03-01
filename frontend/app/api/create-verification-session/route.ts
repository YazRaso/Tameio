import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

export async function POST() {
  try {
    const session = await stripe.identity.verificationSessions.create({
      type: "document",
      options: {
        document: {
          // Require a matching selfie alongside the government-issued ID
          require_matching_selfie: true,
        },
      },
    });

    return NextResponse.json({
      clientSecret: session.client_secret,
      sessionId: session.id,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to create verification session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
