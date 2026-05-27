import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getAnthropic } from "@/lib/anthropic";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are Aria, the AI Chief of Staff at Boardroom AI. You are on the marketing landing page helping prospects understand the product. Be warm, helpful, and concise.

Key facts:
- 6 AI executives: Maya (CMO), Owen (COO), Felix (CFO), Eden (CEO), Tariq (CTO), Aria (Chief of Staff)
- Pricing: Starter $79/mo + $297 setup (3 execs), Growth $197/mo + $297 setup (all 6 + Aria), Scale $497/mo + $297 setup
- Setup takes 30 minutes
- Each executive is customized to the owner's business profile and brand voice
- The platform runs in the cloud, accessible from any browser

Answer questions honestly. If asked about something not in your knowledge, say so. Always end with a CTA to try it: "Ready to meet your AI C-Suite? [Get access →](/login)"`;

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000)
});

const RequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(20)
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
    return NextResponse.json({ error: "Session message limit reached." }, { status: 429 });
  }

  let anthropic: ReturnType<typeof getAnthropic>;
  try {
    anthropic = getAnthropic();
  } catch {
    return NextResponse.json({ error: "AI service not configured." }, { status: 503 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = anthropic.messages.stream({
          model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
          max_tokens: 400,
          system: SYSTEM_PROMPT,
          messages: messages.map((m) => ({ role: m.role, content: m.content }))
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
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache"
    }
  });
}
