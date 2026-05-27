export const metadata = { title: "Admin Settings" };

function maskKey(key: string | undefined): string {
  if (!key) return "(not set)";
  if (key.length <= 12) return "•".repeat(key.length);
  return key.slice(0, 6) + "•".repeat(key.length - 10) + key.slice(-4);
}

export default function AdminSettingsPage(): React.ReactElement {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(not set)";
  const supabaseAnon = maskKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return (
    <div className="p-10 max-w-3xl">
      <h1 className="serif text-4xl mb-8">Admin Settings</h1>

      {/* API Keys section */}
      <section className="card mb-6">
        <h2 className="font-bold text-lg mb-1">API Keys</h2>
        <p className="text-sm text-[var(--muted)] mb-5">
          All secrets are stored as Cloudflare Workers secrets via{" "}
          <code className="text-xs bg-[var(--soft)] px-1.5 py-0.5 rounded font-mono">wrangler secret put</code>.
          Never commit these to git.
        </p>
        <div className="space-y-4">
          {[
            {
              name: "ANTHROPIC_API_KEY",
              desc: "Anthropic Claude API key — powers all AI executive conversations."
            },
            {
              name: "SUPABASE_SERVICE_ROLE_KEY",
              desc: "Supabase service role key — used for admin writes that bypass RLS."
            },
            {
              name: "STRIPE_SECRET_KEY",
              desc: "Stripe secret key — used for checkout sessions and billing."
            },
            {
              name: "STRIPE_WEBHOOK_SECRET",
              desc: "Stripe webhook signing secret — validates incoming webhook events."
            }
          ].map(({ name, desc }) => (
            <div key={name} className="rounded-xl border border-[var(--line)] p-4">
              <p className="text-sm font-bold font-mono mb-1">{name}</p>
              <p className="text-xs text-[var(--muted)] mb-3">{desc}</p>
              <code className="block text-xs bg-[var(--soft)] rounded-lg p-3 font-mono text-[var(--ink)]">
                wrangler secret put {name}
              </code>
            </div>
          ))}
        </div>
      </section>

      {/* Supabase section */}
      <section className="card mb-6">
        <h2 className="font-bold text-lg mb-4">Supabase</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between gap-4 items-center">
            <span className="text-[var(--muted)]">Project URL</span>
            <code className="text-xs bg-[var(--soft)] px-2 py-1 rounded font-mono">{supabaseUrl}</code>
          </div>
          <div className="flex justify-between gap-4 items-center">
            <span className="text-[var(--muted)]">Anon key (masked)</span>
            <code className="text-xs bg-[var(--soft)] px-2 py-1 rounded font-mono">{supabaseAnon}</code>
          </div>
        </div>
      </section>

      {/* Make someone admin */}
      <section className="card">
        <h2 className="font-bold text-lg mb-1">Grant Admin Access</h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          Run this SQL snippet in the Supabase Dashboard → SQL Editor. Replace{" "}
          <code className="text-xs bg-[var(--soft)] px-1 py-0.5 rounded font-mono">EMAIL</code> with the
          target user&apos;s email address.
        </p>
        <pre className="text-xs bg-[var(--ink)] text-white rounded-xl p-4 overflow-x-auto font-mono leading-relaxed">
          {`update public.profiles\n  set is_admin = true\nwhere email = 'EMAIL';`}
        </pre>
      </section>
    </div>
  );
}
