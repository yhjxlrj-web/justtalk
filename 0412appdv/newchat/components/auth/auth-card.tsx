import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { LogoMark } from "@/components/ui/logo-mark";

type AuthCardProps = {
  brandName: string;
  brandTagline: string;
  children: React.ReactNode;
  headerSlot?: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  footerText: string;
  footerLink: string;
  footerLabel: string;
  panelTitle: string;
  panelDescription: string;
  panelNoteLabel: string;
  panelNoteBody: string;
};

export function AuthCard({
  brandName,
  brandTagline,
  children,
  description,
  eyebrow,
  footerLabel,
  footerLink,
  footerText,
  headerSlot,
  panelDescription,
  panelNoteBody,
  panelNoteLabel,
  panelTitle,
  title
}: AuthCardProps) {
  return (
    <GlassCard className="w-full max-w-5xl overflow-hidden">
      <div className="grid min-h-[720px] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="hidden bg-aurora p-10 lg:flex lg:flex-col lg:justify-between">
          <LogoMark appName={brandName} tagline={brandTagline} />
          <div>
            <p className="font-[family-name:var(--font-display)] text-5xl leading-tight text-ink">{panelTitle}</p>
            <p className="mt-5 max-w-md text-base leading-7 text-slate-600">{panelDescription}</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-soft">
            <p className="text-xs uppercase tracking-[0.3em] text-brand-700/80">{panelNoteLabel}</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">{panelNoteBody}</p>
          </div>
        </div>

        <div className="flex flex-col justify-center px-3.5 py-7 sm:px-5 sm:py-8 lg:px-10">
          <div className="mb-7 lg:hidden">
            <LogoMark appName={brandName} tagline={brandTagline} />
          </div>
          <p className="text-xs uppercase tracking-[0.32em] text-brand-700/80">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold text-ink sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
            {description}
          </p>

          {headerSlot ? <div className="mt-6">{headerSlot}</div> : null}

          <div className="mt-6">{children}</div>

          <p className="mt-6 text-sm text-slate-500">
            {footerText}{" "}
            <Link href={footerLink} className="font-semibold text-brand-700">
              {footerLabel}
            </Link>
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
