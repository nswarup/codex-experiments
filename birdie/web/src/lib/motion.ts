/** "smooth" unless the reader asked the system for less motion. */
export function smooth(): ScrollBehavior {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
