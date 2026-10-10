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
  const theme = useApp((s) => s.prefs.theme);
  const size = useApp((s) => s.prefs.size);
  const spacing = useApp((s) => s.prefs.spacing);
  const glassPref = useApp((s) => s.prefs.lab.glass);
  const onboarded = useApp((s) => s.onboarded);

  useEffect(() => {
    document.documentElement.dataset.glass = glassPref ? "on" : "off";
  }, [glassPref]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.readerTheme = theme;
    // First run is the sage brand screen; after that the bar follows the reading theme.
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", onboarded ? THEME_COLOR[theme] : "#6f8d77");
  }, [theme, onboarded]);

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
      {/* Toasts are compact pills near the bottom (see Notify), clear of the reading line. */}
      <Toaster
        position="bottom-center"
        gap={8}
        offset={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
        mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)", left: "16px", right: "16px" }}
        toastOptions={{ unstyled: true }}
      />
    </MotionConfig>
  );
}
