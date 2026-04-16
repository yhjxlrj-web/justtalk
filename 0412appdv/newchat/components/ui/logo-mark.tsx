import Link from "next/link";

type LogoMarkProps = {
  appName?: string;
  tagline?: string;
};

export function LogoMark({
  appName = "JustTalk",
  tagline = "Just talk, in your language."
}: LogoMarkProps) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500 text-lg font-bold text-white shadow-float">
        T
      </div>
      <div>
        <p className="text-base font-semibold text-ink">{appName}</p>
        <p className="text-xs tracking-[0.02em] text-slate-500">{tagline}</p>
      </div>
    </Link>
  );
}
