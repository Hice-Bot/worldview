/**
 * Crosshair - Center-screen targeting reticle
 * CSS-only implementation, always visible, subtle design.
 */
export default function Crosshair() {
  return (
    <div className="fixed inset-0 pointer-events-none z-40 flex items-center justify-center">
      <div className="relative w-8 h-8">
        {/* Horizontal line */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20 -translate-y-1/2" />
        {/* Vertical line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20 -translate-x-1/2" />
        {/* Center dot */}
        <div className="absolute top-1/2 left-1/2 w-1 h-1 rounded-full bg-white/30 -translate-x-1/2 -translate-y-1/2" />
      </div>
    </div>
  );
}
