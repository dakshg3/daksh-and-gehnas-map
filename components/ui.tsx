import clsx from "clsx";
import type { PropsWithChildren } from "react";

export function PageShell({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={clsx(
        "relative min-h-dvh overflow-hidden bg-gradient-to-b from-violet-100 via-purple-50 to-indigo-50 text-zinc-900",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="floral-spray floral-float-slow absolute -left-10 -top-14 h-64 w-64 opacity-55" />
        <div className="floral-spray floral-float absolute left-[12%] top-12 h-28 w-28 -rotate-6 opacity-35" />
        <div className="floral-spray floral-float-delayed absolute right-[14%] top-24 h-24 w-24 rotate-12 opacity-30" />
        <div className="floral-spray floral-float-slow absolute -bottom-20 -right-12 h-72 w-72 rotate-180 opacity-50" />
        <div className="floral-petal-dust absolute inset-x-0 top-0 h-48 opacity-70" />
        <div className="floral-petal-dust absolute inset-x-0 bottom-0 h-56 -scale-y-100 opacity-60" />
      </div>
      {children}
    </div>
  );
}

export function Container({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={clsx("mx-auto w-full max-w-6xl px-4", className)}>
      {children}
    </div>
  );
}

export function Card({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={clsx(
        "rounded-3xl bg-white/70 p-4 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.35)] ring-1 ring-white/40 backdrop-blur",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Pill({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-700 ring-1 ring-violet-500/10",
        className
      )}
    >
      {children}
    </span>
  );
}
