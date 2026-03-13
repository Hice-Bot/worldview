/**
 * Crosshair - Center-screen targeting reticle
 * CSS-only implementation, always visible, subtle design.
 * Visible on both light and dark backgrounds via drop-shadow.
 */
export default function Crosshair() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-40 flex items-center justify-center"
      style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.5))' }}
    >
      <div className="relative w-8 h-8">
        {/* Horizontal line */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/25 -translate-y-1/2" />
        {/* Vertical line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/25 -translate-x-1/2" />
        {/* Center dot */}
        <div className="absolute top-1/2 left-1/2 w-1 h-1 rounded-full bg-white/35 -translate-x-1/2 -translate-y-1/2" />
      </div>
    </div>
  );
}
