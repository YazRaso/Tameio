import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST() {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Stripe secret key is not configured" },
      { status: 500 }
    );
  }

  const stripe = new Stripe(apiKey, {
    apiVersion: "2026-02-25.clover",
  });

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
