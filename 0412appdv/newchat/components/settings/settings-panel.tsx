"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";

export function SettingsPanel() {
  const [settings, setSettings] = useState({
    autoTranslate: true,
    roomSummaries: true,
    pushAlerts: false
  });

  return (
    <GlassCard className="p-6">
      <p className="text-sm font-semibold text-ink">Quick settings</p>
      <div className="mt-5 space-y-4">
        {[
          {
            key: "autoTranslate",
            label: "Auto-translate incoming messages",
            description: "Apply your preferred target language on receipt."
          },
          {
            key: "roomSummaries",
            label: "Generate bilingual room summaries",
            description: "Reserve this toggle for a server-side OpenAI summary workflow."
          },
          {
            key: "pushAlerts",
            label: "Push notifications for mentions",
            description: "Future hook for device or browser notifications."
          }
        ].map((item) => {
          const checked = settings[item.key as keyof typeof settings];

          return (
            <label
              key={item.key}
              className="flex cursor-pointer items-start justify-between gap-4 rounded-[22px] border border-slate-200 bg-white p-4 shadow-soft"
            >
              <div>
                <p className="text-sm font-medium text-ink">{item.label}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSettings((current) => ({
                    ...current,
                    [item.key]: !current[item.key as keyof typeof current]
                  }))
                }
                className={`relative h-7 w-12 rounded-full transition ${
                  checked ? "bg-brand-500" : "bg-slate-200"
                }`}
                aria-pressed={checked}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                    checked ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </label>
          );
        })}
      </div>
    </GlassCard>
  );
}
