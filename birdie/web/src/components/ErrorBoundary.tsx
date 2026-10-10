import { Component, type ReactNode } from "react";
import { resetEverything } from "@/lib/store";

/** Last-resort safety net: never leave the reader on a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[birdie]", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="mx-auto flex min-h-dvh max-w-[34em] flex-col justify-center px-6 font-serif">
        <h1 className="text-[28px] font-medium text-strong">Birdie tripped over something.</h1>
        <p className="mt-3 text-[17px] text-text">Your interests and saved topics are safe on this device.</p>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <button
            type="button"
            onClick={() => location.reload()}
            className="press h-12 rounded-full bg-accent px-6 text-[16px] font-semibold text-accent-fg"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => {
              resetEverything();
              location.reload();
            }}
            className="press h-12 px-1 text-[16px] text-muted underline underline-offset-4"
          >
            Still stuck? Start fresh
          </button>
        </div>
      </main>
    );
  }
}
