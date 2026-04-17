import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function Input({ className, error, hint, id, label, ...props }: InputProps) {
  return (
    <label className="block space-y-2" htmlFor={id}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        id={id}
        className={cn(
          "w-full rounded-[14px] border bg-white px-4 py-3 text-sm text-ink shadow-soft outline-none transition placeholder:text-slate-400 focus:ring-2",
          error
            ? "border-rose-200 focus:border-rose-200 focus:ring-rose-100"
            : "border-slate-200 focus:border-brand-200 focus:ring-brand-100",
          className
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
      />
      {error ? (
        <span id={`${id}-error`} className="block text-xs text-rose-500">
          {error}
        </span>
      ) : null}
      {!error && hint ? (
        <span id={`${id}-hint`} className="block text-xs text-slate-500">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
