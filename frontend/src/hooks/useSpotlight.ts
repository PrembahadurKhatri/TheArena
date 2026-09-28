import { useRef } from "react";
import type { MouseEvent } from "react";

// Tracks the cursor position within an element and writes it to CSS custom
// properties (--spot-x / --spot-y) via a direct DOM mutation -- no React
// state, so it doesn't re-render on every mousemove. Pair with the
// `.spotlight` utility class in index.css, which reads those variables for
// a soft radial highlight that follows the cursor on hover.
export function useSpotlight<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  const onMouseMove = (e: MouseEvent<T>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty("--spot-y", `${((e.clientY - rect.top) / rect.height) * 100}%`);
  };

  return { ref, onMouseMove };
}
