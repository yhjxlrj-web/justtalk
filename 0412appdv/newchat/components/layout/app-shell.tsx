import type { Dictionary, SupportedLocale } from "@/lib/i18n/messages";
import { DictionaryProvider } from "@/components/providers/dictionary-provider";
import { HomeTabProvider } from "@/components/providers/home-tab-provider";
import { ShellFrame } from "@/components/layout/shell-frame";

export function AppShell({
  children,
  dictionary,
  locale
}: {
  children: React.ReactNode;
  dictionary: Dictionary;
  locale: SupportedLocale;
}) {
  return (
    <DictionaryProvider dictionary={dictionary} locale={locale}>
      <HomeTabProvider>
        <ShellFrame>{children}</ShellFrame>
      </HomeTabProvider>
    </DictionaryProvider>
  );
}
