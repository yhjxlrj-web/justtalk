import { messages, type Dictionary, type SupportedLocale } from "@/lib/i18n/messages";

const localeAliases = new Map<string, SupportedLocale>([
  ["ko", "ko"],
  ["korean", "ko"],
  ["한국어", "ko"],
  ["en", "en"],
  ["english", "en"],
  ["영어", "en"],
  ["es", "es"],
  ["spanish", "es"],
  ["español", "es"],
  ["espanol", "es"],
  ["스페인어", "es"]
]);

const localeLabels: Record<SupportedLocale, string> = {
  ko: "한국어",
  en: "English",
  es: "Español"
};

export function resolveLocale(value?: string | null): SupportedLocale {
  if (!value) {
    return "en";
  }

  const normalized = value.trim().toLowerCase();
  return localeAliases.get(normalized) ?? "en";
}

export function getDictionary(value?: string | null): Dictionary {
  return messages[resolveLocale(value)];
}

export function getLocaleLabel(value?: string | null): string {
  return localeLabels[resolveLocale(value)];
}

export function getLocaleOptions() {
  return [
    { value: "ko" as const, label: localeLabels.ko },
    { value: "en" as const, label: localeLabels.en },
    { value: "es" as const, label: localeLabels.es }
  ];
}
