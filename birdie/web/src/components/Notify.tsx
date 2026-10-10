import { toast } from "sonner";

/**
 * Birdie's toast: a compact pill that hugs its text, low on the screen, out of the reading
 * line. One short sentence and at most one text action ("Undo", "View"). Glass or solid
 * follows the Design lab material through the same classes as the rest of the controls.
 */
export function notify(message: string, opts: { action?: { label: string; onClick: () => void }; duration?: number } = {}) {
  toast.custom(
    (id) => (
      <div className="flex w-full justify-center" role="status">
        <div className="glass-heavy glass-ink relative flex min-h-11 max-w-full items-center gap-1 rounded-full bg-strong py-1 pr-1 pl-4 font-sans text-[14px] font-medium tracking-[-0.005em] text-bg shadow-[var(--shadow)]">
          <span className="min-w-0 truncate py-1.5 pr-2">{message}</span>
          {opts.action && (
            <button
              type="button"
              onClick={() => {
                opts.action!.onClick();
                toast.dismiss(id);
              }}
              className="press flex h-9 shrink-0 items-center rounded-full px-3.5 font-semibold underline-offset-4 hover:underline"
            >
              {opts.action.label}
            </button>
          )}
        </div>
      </div>
    ),
    { duration: opts.duration ?? 2600 },
  );
}
