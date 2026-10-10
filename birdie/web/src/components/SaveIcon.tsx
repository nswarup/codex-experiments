import { useEffect, useRef } from "react";
import { motion } from "motion/react";

/**
 * A bookmark that fills when saved. Saving gives it a short spring "pop"; unsaving just
 * empties it, so the stronger motion only celebrates the positive action.
 */
export function SaveIcon({ saved, size = 18 }: { saved: boolean; size?: number }) {
  // Pop only on the change from unsaved to saved, never when a page opens already saved.
  const prev = useRef(saved);
  const popped = saved && !prev.current;
  useEffect(() => {
    prev.current = saved;
  });
  return (
    <motion.svg
      key={saved ? "on" : "off"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      initial={popped ? { transform: "scale(0.6)" } : false}
      animate={{ transform: "scale(1)" }}
      transition={popped ? { type: "spring", stiffness: 520, damping: 14, mass: 0.6 } : { duration: 0 }}
    >
      <path d="M17 3a2 2 0 0 1 2 2v16l-7-4-7 4V5a2 2 0 0 1 2-2z" fill={saved ? "currentColor" : "none"} />
    </motion.svg>
  );
}
