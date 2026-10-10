import { Component, type ReactNode } from "react";

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
        <button
          type="button"
          onClick={() => location.reload()}
          className="press mt-6 h-12 self-start rounded-full bg-accent px-6 text-[16px] font-semibold text-accent-fg"
        >
          Reload
        </button>
      </main>
    );
  }
}
