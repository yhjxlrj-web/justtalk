import { useDictionary } from "@/components/providers/dictionary-provider";
import { PrimaryButton } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

export function EmptyConversationState({
  onQuickSend
}: {
  onQuickSend: (message: string) => void;
}) {
  const dictionary = useDictionary();

  return (
    <GlassCard className="mx-auto max-w-md px-6 py-5 text-center">
      <p className="text-base font-semibold text-ink">{dictionary.emptyConversationGreeting}</p>
      <PrimaryButton
        type="button"
        className="mt-3 rounded-full px-4 py-2.5 text-sm"
        onClick={() => onQuickSend(dictionary.emptyConversationQuickSend)}
      >
        {dictionary.emptyConversationQuickSend}
      </PrimaryButton>
    </GlassCard>
  );
}
