import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonProps = {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  disablePressEffect?: boolean;
  href?: string;
  name?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onPointerCancel?: React.PointerEventHandler<HTMLButtonElement>;
  onPointerDown?: React.PointerEventHandler<HTMLButtonElement>;
  onPointerEnter?: React.PointerEventHandler<HTMLButtonElement>;
  onPointerLeave?: React.PointerEventHandler<HTMLButtonElement>;
  onPointerUp?: React.PointerEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
  value?: string;
};

const sharedClasses =
  "inline-flex items-center justify-center rounded-full px-4 py-2.5 text-[13px] font-semibold transform-gpu transition-[transform,box-shadow,background-color,border-color,color] duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 sm:px-5 sm:py-3 sm:text-sm";

const pressableClasses =
  "active:scale-[0.985] active:translate-y-[1.5px] active:shadow-none disabled:active:scale-100 disabled:active:translate-y-0";

export function PrimaryButton({
  children,
  className,
  disabled,
  disablePressEffect = false,
  href,
  name,
  onClick,
  onPointerCancel,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onPointerUp,
  type = "button",
  value
}: ButtonProps) {
  const classes = cn(
    sharedClasses,
    !disablePressEffect && pressableClasses,
    "primary-action-button bg-brand-500 text-white shadow-float hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70",
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled}
      onClick={onClick}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerUp={onPointerUp}
      name={name}
      value={value}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className,
  disabled,
  disablePressEffect = false,
  href,
  name,
  onClick,
  onPointerCancel,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onPointerUp,
  type = "button",
  value
}: ButtonProps) {
  const classes = cn(
    sharedClasses,
    !disablePressEffect && pressableClasses,
    "secondary-action-button border border-brand-100 bg-white text-brand-700 shadow-soft hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70",
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled}
      onClick={onClick}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerUp={onPointerUp}
      name={name}
      value={value}
    >
      {children}
    </button>
  );
}
