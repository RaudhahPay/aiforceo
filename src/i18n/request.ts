// next-intl request configuration.
// Locale is read from a cookie (boardroom_locale) or defaults to 'en'.
// To add a new language: add the locale to LOCALES and create src/i18n/locales/{locale}.json
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const LOCALES = ["en", "ms"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "boardroom_locale";

export default getRequestConfig(async () => {
  const jar = await cookies();
  const cookieLocale = jar.get(LOCALE_COOKIE)?.value as Locale | undefined;
  const locale: Locale = LOCALES.includes(cookieLocale!) ? cookieLocale! : DEFAULT_LOCALE;

  const messages = (await import(`./locales/${locale}.json`)) as { default: Record<string, unknown> };

  return {
    locale,
    messages: messages.default,
  };
});
