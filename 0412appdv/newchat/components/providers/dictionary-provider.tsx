"use client";

import { createContext, useContext } from "react";
import type { Dictionary, SupportedLocale } from "@/lib/i18n/messages";

const DictionaryContext = createContext<Dictionary | null>(null);
const LocaleContext = createContext<SupportedLocale | null>(null);

export function DictionaryProvider({
  children,
  dictionary,
  locale
}: {
  children: React.ReactNode;
  dictionary: Dictionary;
  locale: SupportedLocale;
}) {
  return (
    <LocaleContext.Provider value={locale}>
      <DictionaryContext.Provider value={dictionary}>{children}</DictionaryContext.Provider>
    </LocaleContext.Provider>
  );
}

export function useDictionary() {
  const dictionary = useContext(DictionaryContext);

  if (!dictionary) {
    throw new Error("useDictionary must be used within a DictionaryProvider.");
  }

  return dictionary;
}

export function useCurrentLocale() {
  const locale = useContext(LocaleContext);

  if (!locale) {
    throw new Error("useCurrentLocale must be used within a DictionaryProvider.");
  }

  return locale;
}
