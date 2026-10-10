import { useEffect } from "react";
import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import { useApp, startSession } from "@/lib/store";
import { Onboarding } from "@/components/Onboarding";
import { Reader } from "@/components/Reader";
import "@/lib/feedback";

const FONT_SIZES = [16, 17, 18, 20, 22];
const LINE_HEIGHTS = [1.45, 1.6, 1.8];
const THEME_COLOR = { dark: "#121212", sepia: "#f4ecd8", light: "#fbfaf7" } as const;

let sessionStarted = false;

export function App() {
  const onboarded = useApp((s) => s.onboarded);
  const theme = useApp((s) => s.prefs.theme);
  const size = useApp((s) => s.prefs.size);
  const spacing = useApp((s) => s.prefs.spacing);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--read-size", `${FONT_SIZES[size] ?? 18}px`);
    root.style.setProperty("--read-leading", String(LINE_HEIGHTS[spacing] ?? 1.6));
  }, [size, spacing]);

  useEffect(() => {
    if (onboarded && !sessionStarted) {
      sessionStarted = true;
      startSession();
    }
  }, [onboarded]);

  return (
    <MotionConfig reducedMotion="user">
      {onboarded ? <Reader /> : <Onboarding />}
      <Toaster
        position="top-center"
        offset={{ top: "calc(env(safe-area-inset-top, 0px) + 64px)" }}
        toastOptions={{
          style: {
            background: "var(--strong)",
            color: "var(--bg)",
            border: "none",
            fontFamily: "var(--font-serif)",
            fontSize: "15px",
            borderRadius: "14px",
          },
        }}
      />
    </MotionConfig>
  );
}
