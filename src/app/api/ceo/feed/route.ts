/**
 * POST /api/ceo/feed — venture data feed (server-to-server).
 *
 * External venture systems (AHMAD AI CEO, later EzPOS) push daily numbers.
 * Auth: HMAC-SHA256 of the raw body with CEO_FEED_SECRET, sent as
 * x-feed-signature (hex). No session — this is machine-to-machine, same
 * trust model as /api/stripe/webhook.
 */

import { NextResponse } from "next/server";
import { ingestFeed, verifyFeedSignature } from "@/lib/ceo-dashboard/feed";

export async function POST(req: Request) {
  const secret = process.env.CEO_FEED_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Feed not configured (CEO_FEED_SECRET missing)" },
      { status: 503 },
    );
  }

  const rawBody = await req.text();
  if (rawBody.length > 256_000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const ok = await verifyFeedSignature(
    rawBody,
    req.headers.get("x-feed-signature"),
    secret,
  );
  if (!ok) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const result = await ingestFeed(JSON.parse(rawBody));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Ingest failed" },
      { status: 400 },
    );
  }
}
