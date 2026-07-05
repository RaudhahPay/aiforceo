/**
 * AIforCEO — Cloudflare Cron Worker
 *
 * A tiny Worker deployed separately from the main app (wrangler-cron.jsonc).
 * Its only job: fire hourly, call the app's cron route, and log the result.
 *
 * Deploy:
 *   pnpm wrangler secret put CRON_SECRET --config wrangler-cron.jsonc
 *   pnpm wrangler deploy --config wrangler-cron.jsonc
 *
 * The cron trigger (every hour on the hour) is configured in wrangler-cron.jsonc.
 */

import type {
  ScheduledEvent,
  ExecutionContext,
} from "@cloudflare/workers-types";

interface Env {
  APP_URL: string;
  CRON_SECRET: string;
}

const cronWorker = {
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      fetch(`${env.APP_URL}/api/cron/morning-brief`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CRON_SECRET}`,
          "Content-Type": "application/json",
        },
      })
        .then(async (res) => {
          const body = await res.text();
          console.log(`[morning-brief-cron] ${res.status} — ${body}`);
        })
        .catch((err: unknown) => {
          console.error("[morning-brief-cron] fetch failed:", err);
        }),
    );
  },
};

export default cronWorker;
