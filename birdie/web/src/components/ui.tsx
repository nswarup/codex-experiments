/* Small shared primitives: shadcn-style, themed through CSS variables. */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/cn";

export function BirdMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M10 34c4-10 14-15 24-12l9-6-1.5 9c1.5 9-5 16-15 16-7 0-13-3-16.5-7z" />
      <path d="M22 30c4 0 8-2 10-5" />
      <circle cx="36" cy="22" r="0.9" fill="currentColor" />
      <path d="M24 41l-2 6M30 41l1 6" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={cn("font-serif text-[21px] font-medium italic tracking-[0.01em] text-strong", className)}>birdie</span>;
}

type Variant = "primary" | "secondary" | "ghost";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "md" | "lg" | "sm" }>(
  function Button({ variant = "primary", size = "md", className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "press inline-flex select-none items-center justify-center gap-2 rounded-full font-serif font-semibold disabled:cursor-not-allowed",
          size === "lg" && "h-[54px] px-6 text-[17px]",
          size === "md" && "h-12 px-5 text-[16px]",
          size === "sm" && "h-10 px-4 text-[15px]",
          variant === "primary" && "bg-accent text-accent-fg disabled:bg-line disabled:text-muted",
          variant === "secondary" && "border border-chip bg-transparent text-text",
          variant === "ghost" && "bg-transparent text-text",
          className,
        )}
        {...rest}
      />
    );
  },
);

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(
  function IconButton({ label, className, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        className={cn("press flex h-11 w-11 items-center justify-center rounded-full text-text active:bg-inset", className)}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[11.5px] font-medium uppercase tracking-[0.1em] text-muted", className)}>{children}</span>
  );
}

/** A themed bottom sheet built on Vaul (drag to dismiss, momentum, iOS curve). */
export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
  tall = false,
  describedBy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  tall?: boolean;
  describedBy?: string;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()} repositionInputs>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40" />
        <Drawer.Content
          aria-describedby={describedBy}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[640px] flex-col rounded-t-[22px] border-t border-sheet-line bg-sheet text-text outline-none",
            tall ? "h-[92dvh]" : "max-h-[92dvh]",
            className,
          )}
          style={{ boxShadow: "var(--shadow)" }}
        >
          <div aria-hidden="true" className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-chip" />
          <Drawer.Title className="sr-only">{title}</Drawer.Title>
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** One header for every sheet: same height, same title size, same 44px close target. */
export function SheetHeader({ title, onClose, children }: { title: ReactNode; onClose: () => void; children?: ReactNode }) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-3 pr-3 pl-6">
      <h2 className="min-w-0 truncate font-serif text-[17px] font-semibold text-strong">{title}</h2>
      <div className="flex shrink-0 items-center">
        {children}
        <button
          type="button"
          aria-label="Close"
          title="Close"
          onClick={onClose}
          className="press flex h-11 w-11 items-center justify-center rounded-full text-muted active:bg-inset"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode; ariaLabel?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-1 rounded-xl bg-inset p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.ariaLabel}
            onClick={() => onChange(o.value)}
            className={cn(
              "press h-10 rounded-[9px] font-serif text-[15px] whitespace-nowrap transition-colors duration-150",
              on ? "bg-[var(--seg-on)] font-semibold text-strong shadow-[0_1px_3px_rgba(0,0,0,0.18)]" : "text-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="press flex h-12 w-full items-center justify-between gap-4 text-left font-serif text-[16px] text-text"
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        className={cn(
          "relative h-[28px] w-[46px] shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-accent" : "bg-chip",
        )}
      >
        <span
          className="absolute top-[3px] left-[3px] h-[22px] w-[22px] rounded-full bg-sheet shadow transition-transform duration-200 ease-[var(--ease-out)]"
          style={{ transform: checked ? "translateX(18px)" : "translateX(0)" }}
        />
      </span>
    </button>
  );
}
