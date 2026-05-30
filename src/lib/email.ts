// Email delivery via Resend.
// RESEND_API_KEY must be set as a Cloudflare secret:
//   pnpm wrangler secret put RESEND_API_KEY
//
// For local dev add to .env.local:
//   RESEND_API_KEY=re_...
import { Resend } from "resend";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.startsWith("re_dummy") || key === "") return null;
  return new Resend(key);
}

export type EmailResult = { ok: true } | { ok: false; error: string };

/** Send the daily morning brief to the workspace owner. */
export async function sendMorningBriefEmail(opts: {
  toEmail: string;
  workspaceName: string;
  briefContent: string;
  date: string;
}): Promise<EmailResult> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "RESEND_API_KEY not configured" };

  const { toEmail, workspaceName, briefContent, date } = opts;

  // Convert markdown-style content to readable HTML
  const htmlContent = briefContent
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^### (.*)/gm, "<h3 style='margin:16px 0 6px;color:#0E1726;font-size:14px;font-weight:700'>$1</h3>")
    .replace(/^## (.*)/gm, "<h2 style='margin:20px 0 8px;color:#0E1726;font-size:16px;font-weight:700'>$1</h2>")
    .replace(/^# (.*)/gm, "<h1 style='margin:24px 0 10px;color:#0E1726;font-size:18px;font-weight:700'>$1</h1>")
    .replace(/^- (.*)/gm, "<li style='margin:4px 0'>$1</li>")
    .replace(/\n\n/g, "</p><p style='margin:8px 0'>")
    .replace(/\n/g, "<br>");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- Header -->
        <tr><td style="background:#0E1726;padding:24px 32px;border-radius:12px 12px 0 0">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="font-size:18px;font-weight:700;color:#fff">Boardroom <span style="color:#C5A572">AI</span></span><br>
                <span style="font-size:12px;color:rgba(255,255,255,0.5);font-weight:600;text-transform:uppercase;letter-spacing:0.05em">${workspaceName}</span>
              </td>
              <td align="right">
                <span style="font-size:11px;color:rgba(255,255,255,0.4)">${date}</span>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:22px;font-weight:700;color:#C5A572">☀ Morning Executive Brief</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:32px;border-radius:0 0 12px 12px">
          <p style="margin:0 0 8px;font-size:13px;color:#64748b">Your AI Chief of Staff — Aria — has prepared your morning briefing.</p>
          <div style="background:#f8fafc;border-left:4px solid #C5A572;padding:20px 24px;border-radius:0 8px 8px 0;margin:20px 0">
            <p style="margin:0;font-size:14px;line-height:1.7;color:#1e293b">
              ${htmlContent}
            </p>
          </div>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0">
            <tr><td align="center">
              <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://aiforceo.app"}/agent/aria"
                 style="display:inline-block;background:#C5A572;color:#0E1726;padding:14px 32px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none">
                Open Aria for full briefing →
              </a>
            </td></tr>
          </table>

          <p style="margin:24px 0 0;font-size:11px;color:#94a3b8;text-align:center">
            You received this because morning briefs are enabled for ${workspaceName}.<br>
            <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://aiforceo.app"}/settings#notifications"
               style="color:#94a3b8">Manage notification settings</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: "Boardroom AI <briefs@aiforceo.app>",
      to: toEmail,
      subject: `☀ ${workspaceName} — Morning Brief · ${date}`,
      html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Email send failed" };
  }
}

/** Send a workspace invite to a team member. */
export async function sendInviteEmail(opts: {
  toEmail: string;
  workspaceName: string;
  inviterEmail: string;
  role: string;
  acceptUrl: string;
}): Promise<EmailResult> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "RESEND_API_KEY not configured" };

  const { toEmail, workspaceName, inviterEmail, role, acceptUrl } = opts;
  const roleLabel = role === "manager" ? "Manager" : "Member";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
        <tr><td style="background:#0E1726;padding:24px 32px;border-radius:12px 12px 0 0">
          <p style="margin:0;font-size:18px;font-weight:700;color:#fff">Boardroom <span style="color:#C5A572">AI</span></p>
        </td></tr>
        <tr><td style="background:#fff;padding:32px;border-radius:0 0 12px 12px">
          <h2 style="margin:0 0 16px;font-size:20px;color:#0E1726">You've been invited to ${workspaceName}</h2>
          <p style="font-size:14px;color:#64748b;line-height:1.6">
            ${inviterEmail} has invited you to join <strong>${workspaceName}</strong> on Boardroom AI as a <strong>${roleLabel}</strong>.
          </p>
          <p style="font-size:14px;color:#64748b;line-height:1.6">
            Boardroom AI gives your team access to a customized AI C-Suite — 6 executives (CEO, CFO, CMO, COO, CTO, and Aria) briefed on ${workspaceName}'s business profile and goals.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0">
            <tr><td align="center">
              <a href="${acceptUrl}" style="display:inline-block;background:#C5A572;color:#0E1726;padding:14px 32px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none">
                Accept invitation →
              </a>
            </td></tr>
          </table>
          <p style="font-size:11px;color:#94a3b8;text-align:center">
            This invite expires in 7 days. If you didn't expect this, you can ignore it.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: "Boardroom AI <invites@aiforceo.app>",
      to: toEmail,
      subject: `${inviterEmail} invited you to ${workspaceName} on Boardroom AI`,
      html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Email send failed" };
  }
}
