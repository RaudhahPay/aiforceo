"use server";

// Billing actions. createCheckoutSession is invoked from the pricing page
// form. The webhook (which lives at /api/stripe/webhook) is the legitimate
// route-handler exception (D-003).
import { z } from "zod";
import { redirect } from "next/navigation";
import { requireWorkspaceOwner, AuthError } from "@/lib/auth/require";
import { getStripe, PRICE_IDS } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CreateCheckout = z.object({
  plan: z.enum(["starter", "growth", "scale"]),
});

export async function createCheckoutSession(formData: FormData): Promise<void> {
  const parsed = CreateCheckout.safeParse({ plan: formData.get("plan") });
  if (!parsed.success) redirect("/pricing?error=invalid_plan");
  const plan = parsed.data.plan;

  let user: { id: string; email?: string | null };
  let workspaceId: string;
  let setupFeePaid: boolean;
  try {
    const owner = await requireWorkspaceOwner();
    user = { id: owner.user.id, email: owner.user.email };
    workspaceId = owner.workspace.id;
    // Re-read setup_fee_paid via RLS server client.
    const supa = await createSupabaseServerClient();
    const { data } = await supa
      .from("workspaces")
      .select("setup_fee_paid")
      .eq("id", workspaceId)
      .maybeSingle();
    setupFeePaid = Boolean(data?.setup_fee_paid);
  } catch (err) {
    if (err instanceof AuthError && err.code === "UNAUTHENTICATED") {
      redirect(`/login?next=${encodeURIComponent("/pricing")}`);
    }
    throw err;
  }

  const stripe = getStripe();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email ?? undefined,
    line_items: [
      ...(setupFeePaid ? [] : [{ price: PRICE_IDS[plan].setup, quantity: 1 }]),
      { price: PRICE_IDS[plan].sub, quantity: 1 },
    ],
    success_url: `${baseUrl}/dashboard?upgraded=1`,
    cancel_url: `${baseUrl}/pricing`,
    metadata: { workspace_id: workspaceId, user_id: user.id, plan },
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  redirect(session.url);
}

/** Opens the Stripe customer portal for the active workspace's billing. */
export async function createPortalSession(): Promise<void> {
  let workspaceId: string;
  let stripeCustomerId: string | null;
  try {
    const owner = await requireWorkspaceOwner();
    workspaceId = owner.workspace.id;
    const supa = await createSupabaseServerClient();
    const { data } = await supa
      .from("workspaces")
      .select("stripe_customer_id")
      .eq("id", workspaceId)
      .maybeSingle();
    stripeCustomerId = data?.stripe_customer_id ?? null;
  } catch (err) {
    if (err instanceof AuthError && err.code === "UNAUTHENTICATED") {
      redirect("/login?next=/settings");
    }
    throw err;
  }

  if (!stripeCustomerId) redirect("/pricing");

  const stripe = getStripe();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const portal = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${baseUrl}/settings`,
  });
  redirect(portal.url);
}
