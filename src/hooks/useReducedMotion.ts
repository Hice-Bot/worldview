import { useState, useEffect } from 'react';

/**
 * Hook that detects if the user prefers reduced motion.
 * Listens to the prefers-reduced-motion media query and updates reactively.
 *
 * Usage:
 *   const prefersReducedMotion = useReducedMotion();
 *   const animDuration = prefersReducedMotion ? 0 : 250;
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}
