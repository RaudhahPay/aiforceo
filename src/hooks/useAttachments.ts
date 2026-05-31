"use client";

import { useState, useCallback } from "react";

export type Attachment = {
  /** Local UUID — used as React key and for removal */
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** Raw base64 data (no data-URL prefix) — sent to Anthropic */
  base64: string;
  /** Full data URL — used for <img> preview in the UI */
  preview?: string;
};

export const SUPPORTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  // Word .docx
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const ACCEPT_STRING = [
  "image/*",
  ".pdf",
  ".txt",
  ".csv",
  ".md",
  ".docx",
].join(",");

const MAX_FILE_SIZE   = 10 * 1024 * 1024; // 10 MB
const MAX_ATTACHMENTS = 5;

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read "${file.name}"`));
    reader.readAsDataURL(file);
  });
}

/** Strip the `data:<mime>;base64,` prefix, returning raw base64. */
function stripDataURLPrefix(dataURL: string): string {
  const idx = dataURL.indexOf(",");
  return idx === -1 ? dataURL : dataURL.slice(idx + 1);
}

export function useAttachments() {
  const [attachments,  setAttachments]  = useState<Attachment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    setError(null);

    // Validate each file before reading
    for (const file of fileArray) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" exceeds the 10 MB limit.`);
        return;
      }
      const isSupported = SUPPORTED_TYPES.some(
        (t) => file.type === t || file.name.endsWith(".docx")
      );
      if (!isSupported) {
        setError(`"${file.name}" is not a supported file type.`);
        return;
      }
    }

    if (attachments.length + fileArray.length > MAX_ATTACHMENTS) {
      setError(`Maximum ${MAX_ATTACHMENTS} attachments per message.`);
      return;
    }

    setIsProcessing(true);
    try {
      const newAttachments: Attachment[] = [];
      for (const file of fileArray) {
        const dataURL = await readFileAsDataURL(file);
        const base64  = stripDataURLPrefix(dataURL);
        newAttachments.push({
          id:       crypto.randomUUID(),
          name:     file.name,
          mimeType: file.type || "application/octet-stream",
          size:     file.size,
          base64,
          preview:  file.type.startsWith("image/") ? dataURL : undefined,
        });
      }
      setAttachments((prev) => [...prev, ...newAttachments]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file.");
    } finally {
      setIsProcessing(false);
    }
  }, [attachments.length]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    attachments,
    isProcessing,
    error,
    addFiles,
    removeAttachment,
    clearAttachments,
    clearError,
  };
}
