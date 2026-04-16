"use client";

type AuthStatusNoticeProps = {
  tone?: "success" | "error" | "neutral";
  message: string;
};

export function AuthStatusNotice({
  message,
  tone = "neutral"
}: AuthStatusNoticeProps) {
  const toneClassName =
    tone === "success"
      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
      : tone === "error"
        ? "border-rose-100 bg-rose-50 text-rose-600"
        : "border-slate-200 bg-white text-slate-500";

  return (
    <div className={`rounded-[20px] border px-4 py-3 text-sm leading-6 ${toneClassName}`}>
      {message}
    </div>
  );
}
