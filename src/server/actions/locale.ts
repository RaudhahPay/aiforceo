"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALES, type Locale, LOCALE_COOKIE } from "@/i18n/request";

/** Switch the app's display language. Stored in a cookie, persists across sessions. */
export async function setLocale(locale: Locale): Promise<void> {
  if (!LOCALES.includes(locale)) return;
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, {
    httpOnly: false, // Client needs to read it for immediate UI update
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
