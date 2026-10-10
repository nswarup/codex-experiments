/* Small shared primitives: shadcn-style, themed through CSS variables. */
import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/cn";

/** The Birdie bird: a rounded body with a single leaf-shaped wing. Paths are in a 64-unit box. */
export const MARK_BODY =
  "M45 13a9 9 0 0 1 8.6 6.4L61 21.5l-7 3.2C53 40 41 52 25 52H5l9-8.5C10.5 39 10 33 12.6 28 17 19.5 27 16 35.5 19.2 37.4 15.5 41 13 45 13z";
export const MARK_WING = "M15 44C17 31 28 24.5 43 27c-3.5 12-14 18-28 17z";

/**
 * One-colour mark that follows `currentColor`: the wing shows as a lighter cut and the eye as a hole,
 * so it reads on any surface. Pass `wing`/`eye` colours to paint it in the brand's two tones instead.
 */
export function BirdMark({ size = 28, className, wing, eye }: { size?: number; className?: string; wing?: string; eye?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  if (wing || eye) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
        <path d={MARK_BODY} fill="currentColor" />
        {wing && <path d={MARK_WING} fill={wing} />}
        {eye && <circle cx="47" cy="19.5" r="2.2" fill={eye} />}
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <mask id={`bm${id}`}>
        <path d={MARK_BODY} fill="#fff" />
        <path d={MARK_WING} fill="#7a7a7a" />
        <circle cx="47" cy="19.5" r="2.4" fill="#000" />
      </mask>
      <rect width="64" height="64" fill="currentColor" mask={`url(#bm${id})`} />
    </svg>
  );
}

export function Wordmark({ className, markSize = 22 }: { className?: string; markSize?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-brand text-[19px] font-bold tracking-[-0.02em] text-strong", className)}>
      <BirdMark size={markSize} />
      birdie
    </span>
  );
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
          variant === "secondary" && "border border-chip bg-transparent text-text disabled:border-line disabled:text-muted disabled:opacity-60",
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

let keyboardMode = false;
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if (e.key === "Tab" || e.key === "Enter" || e.key === " " || e.key === "/" || e.key === "Escape") keyboardMode = true;
  }, true);
  window.addEventListener("pointerdown", () => (keyboardMode = false), true);
}
/** True when the reader is driving with the keyboard rather than touch or a mouse. */
export function usingKeyboard() {
  return keyboardMode;
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
  // Return focus to whatever opened the sheet once it closes.
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      const a = document.activeElement;
      if (a instanceof HTMLElement && a !== document.body && !a.closest("[role=dialog]")) opener.current = a;
      return;
    }
    const o = opener.current;
    opener.current = null;
    if (!o) return;
    const t = window.setTimeout(() => {
      const a = document.activeElement;
      if (o.isConnected && (!a || a === document.body || !!a.closest("[role=dialog]"))) o.focus({ preventScroll: true });
    }, 320);
    return () => window.clearTimeout(t);
  }, [open]);
  return (
    // Keyboard users get focus moved into (and trapped in) the sheet; on touch that would pop the
    // on-screen keyboard or a focus ring for no reason.
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()} repositionInputs autoFocus={open && usingKeyboard()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40" />
        <Drawer.Content
          aria-describedby={describedBy}
          className={cn(
            "glass-heavy fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[640px] flex-col rounded-t-[22px] border-t border-sheet-line bg-sheet text-text shadow-[var(--shadow)] outline-none",
            // Partial sheets float inset from the screen edges in glass mode; tall ones stay docked.
            tall ? "h-[92dvh]" : "sheet-float max-h-[92dvh]",
            className,
          )}
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
              "press h-11 rounded-[9px] font-serif text-[15px] whitespace-nowrap transition-colors duration-150",
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
