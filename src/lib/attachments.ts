// Background Supabase Storage upload for chat attachments.
// Called fire-and-forget after the assistant message is persisted.
// Errors are silently swallowed — the chat works even if storage fails.
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type StoredAttachment = {
  name:     string;
  mimeType: string;
  size:     number;
  url:      string;
};

export type AttachmentInput = {
  name:     string;
  mimeType: string;
  size:     number;
  base64:   string;
};

/**
 * Upload all attachments for a message to Supabase Storage (private bucket).
 * Runs in the background after message persistence — never blocks the stream.
 *
 * Storage path: chat-attachments/{workspaceId}/{messageId}/{filename}
 */
export async function uploadAttachmentsToStorage(opts: {
  workspaceId: string;
  messageId:   string;
  attachments: AttachmentInput[];
}): Promise<void> {
  if (!opts.attachments.length) return;

  try {
    const admin   = createSupabaseAdminClient();
    const stored: StoredAttachment[] = [];

    for (const att of opts.attachments) {
      try {
        // Decode base64 → Buffer
        const buffer = Buffer.from(att.base64, "base64");
        const path   = `${opts.workspaceId}/${opts.messageId}/${att.name}`;

        const { error: uploadErr } = await admin.storage
          .from("chat-attachments")
          .upload(path, buffer, {
            contentType: att.mimeType,
            upsert:      true,
          });

        if (uploadErr) {
          console.warn("[attachments] Storage upload failed:", uploadErr.message);
          stored.push({ name: att.name, mimeType: att.mimeType, size: att.size, url: "" });
          continue;
        }

        const { data: urlData } = admin.storage
          .from("chat-attachments")
          .getPublicUrl(path);

        stored.push({
          name:     att.name,
          mimeType: att.mimeType,
          size:     att.size,
          url:      urlData.publicUrl,
        });
      } catch {
        stored.push({ name: att.name, mimeType: att.mimeType, size: att.size, url: "" });
      }
    }

    // Back-fill URLs in the messages row
    if (stored.some((s) => s.url)) {
      await admin
        .from("messages")
        .update({ attachments: stored })
        .eq("id", opts.messageId);
    }
  } catch {
    // Non-fatal — chat works even without storage
  }
}
