import { useEffect, useRef, type RefObject } from 'react';

/**
 * useFocusTrap - Traps keyboard focus within a modal container.
 *
 * When active:
 * - Focuses the first focusable element on mount
 * - Tab/Shift+Tab cycle through focusable elements within the container
 * - Focus cannot escape the container via keyboard
 *
 * When deactivated (modal closes), restores focus to the element
 * that was focused before the trap activated.
 *
 * @param containerRef - Ref to the modal container element
 * @param isActive - Whether the focus trap is currently active
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  isActive: boolean
) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Save the previously focused element to restore on close
    previousFocusRef.current = document.activeElement as HTMLElement;

    const container = containerRef.current;

    // Focus the first focusable element after a short delay (allows animation to start)
    const focusTimer = setTimeout(() => {
      const focusable = getFocusableElements(container);
      if (focusable.length > 0) {
        focusable[0]!.focus();
      } else {
        // If no focusable elements, make the container itself focusable
        container.setAttribute('tabindex', '-1');
        container.focus();
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) return;

      const firstFocusable = focusable[0]!;
      const lastFocusable = focusable[focusable.length - 1]!;

      if (e.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus to the previously focused element
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        try {
          previousFocusRef.current.focus();
        } catch {
          // Element may have been removed from DOM
        }
      }
    };
  }, [isActive, containerRef]);
}

/**
 * Gets all focusable elements within a container, in DOM order.
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
  );
}
