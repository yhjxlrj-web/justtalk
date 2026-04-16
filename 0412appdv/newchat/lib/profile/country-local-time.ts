import type { SupportedLocale } from "@/lib/i18n/messages";

const COUNTRY_TIMEZONE_MAP: Record<string, string> = {
  argentina: "America/Argentina/Buenos_Aires",
  australia: "Australia/Sydney",
  brazil: "America/Sao_Paulo",
  canada: "America/Toronto",
  china: "Asia/Shanghai",
  france: "Europe/Paris",
  germany: "Europe/Berlin",
  india: "Asia/Kolkata",
  italy: "Europe/Rome",
  japan: "Asia/Tokyo",
  mexico: "America/Mexico_City",
  singapore: "Asia/Singapore",
  "south korea": "Asia/Seoul",
  korea: "Asia/Seoul",
  "republic of korea": "Asia/Seoul",
  spain: "Europe/Madrid",
  "united kingdom": "Europe/London",
  uk: "Europe/London",
  england: "Europe/London",
  "united states": "America/New_York",
  usa: "America/New_York",
  us: "America/New_York",
  "united states of america": "America/New_York"
};

function normalizeCountry(country: string) {
  return country.trim().toLowerCase();
}

export function getRepresentativeTimezoneFromCountry(country?: string | null) {
  if (!country) {
    return null;
  }

  return COUNTRY_TIMEZONE_MAP[normalizeCountry(country)] ?? null;
}

export function formatCountryLocalTime(country: string | undefined, locale: SupportedLocale) {
  const timezone = getRepresentativeTimezoneFromCountry(country);

  if (!timezone) {
    return null;
  }

  try {
    const formattedTime = new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: locale === "en"
    }).format(new Date());

    if (locale === "ko") {
      return `현재 시각 ${formattedTime}`;
    }

    if (locale === "es") {
      return `Hora local ${formattedTime}`;
    }

    return `Local time ${formattedTime}`;
  } catch {
    return null;
  }
}
