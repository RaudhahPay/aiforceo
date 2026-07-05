import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getAnthropic } from "@/lib/anthropic";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are Aria, Chief of Staff at AIforCEO — The C-Suite by AI. You are the first point of contact for Founders exploring the platform. Be precise, direct, and confident.

Key facts:
- Platform: AIforCEO — six AI Command Executives deployed for the Founder's business
- The 6 executives: Maya (CMO), Owen (COO), Felix (CFO), Eden (CEO), Tariq (CTO), Aria (Chief of Staff)
- Founding member pricing: $47/mo locked for life, setup fee waived — first 30 seats only. After founding seats close: Starter $79/mo, Growth $197/mo, Scale $497/mo (all + $297 setup).
- First output delivered before onboarding finishes. Full C-Suite briefed in under 30 minutes.
- Platform is cloud-based, accessible from any browser

Your first message to any visitor should be a question that makes them think about their business, not a description of the platform. Lead with insight, not features.

Answer questions with authority. If asked about something outside your knowledge, say so directly. Always close with a directive: "Ready to deploy your C-Suite? [Claim your seat →](/login)"`;

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

const RequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(20),
});

export async function POST(req: NextRequest): Promise<NextResponse | Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { messages } = parsed.data;

  // Soft rate limit: only accept up to 20 messages per session (checked by message count already via schema max:20)
  // Additional guard: if all messages total > 20, block
  if (messages.length > 20) {
    return NextResponse.json(
      { error: "Session message limit reached." },
      { status: 429 },
    );
  }

  let anthropic: ReturnType<typeof getAnthropic>;
  try {
    anthropic = getAnthropic();
  } catch {
    return NextResponse.json(
      { error: "AI service not configured." },
      { status: 503 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = anthropic.messages.stream({
          model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
          max_tokens: 400,
          system: SYSTEM_PROMPT,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(encoder.encode(`\n\n[error: ${msg}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
