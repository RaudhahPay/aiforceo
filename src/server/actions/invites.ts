"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspace } from "@/lib/workspace";
import { sendInviteEmail } from "@/lib/email";

type Result = { ok: true } | { ok: false; error: string };

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["member", "manager"]),
});

export async function inviteTeamMember(input: unknown): Promise<Result> {
  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid email or role." };
  const { email, role } = parsed.data;

  await requireUser();
  const ctx = await getCurrentWorkspace();
  if (!ctx) return { ok: false, error: "No workspace found." };

  const admin = createSupabaseAdminClient();

  // Check if already invited (pending, not yet expired)
  const { data: existing } = await admin
    .from("workspace_invites")
    .select("id")
    .eq("workspace_id", ctx.workspace.id)
    .eq("email", email.toLowerCase())
    .is("accepted_at", null)
    .gte("expires_at", new Date().toISOString())
    .maybeSingle();

  if (existing) return { ok: false, error: "This email already has a pending invite." };

  const { data: wsRow } = await admin
    .from("workspaces")
    .select("owner_id")
    .eq("id", ctx.workspace.id)
    .maybeSingle();

  const { data: inviterProfile } = await admin
    .from("profiles")
    .select("id, email")
    .eq("id", wsRow?.owner_id ?? "")
    .maybeSingle();

  if (!inviterProfile) return { ok: false, error: "Could not find inviter profile." };

  const { data: invite, error } = await admin
    .from("workspace_invites")
    .insert({
      workspace_id: ctx.workspace.id,
      email: email.toLowerCase(),
      role,
      invited_by: inviterProfile.id,
    })
    .select("token")
    .single();

  if (error || !invite) return { ok: false, error: error?.message ?? "Could not create invite." };

  // Send invite email (non-fatal)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://aiforceo.app";
  void sendInviteEmail({
    toEmail: email,
    workspaceName: ctx.workspace.name,
    inviterEmail: inviterProfile.email ?? "your team",
    role,
    acceptUrl: `${baseUrl}/invite/accept?token=${invite.token}`,
  });

  revalidatePath("/settings");
  return { ok: true };
}

export async function revokeInvite(inviteId: string): Promise<Result> {
  await requireUser();
  const ctx = await getCurrentWorkspace();
  if (!ctx) return { ok: false, error: "No workspace found." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("workspace_invites")
    .delete()
    .eq("id", inviteId)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function getWorkspaceInvites() {
  await requireUser();
  const ctx = await getCurrentWorkspace();
  if (!ctx) return [];

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("workspace_invites")
    .select("id, email, role, accepted_at, created_at, expires_at")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return data ?? [];
}
