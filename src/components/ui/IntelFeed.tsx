import { useRef, useEffect, useState, useCallback } from 'react';
import type { IntelEvent } from '../../types';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface IntelFeedProps {
  events: IntelEvent[];
}

// 6 event types with distinct colors
const EVENT_COLORS: Record<IntelEvent['type'], string> = {
  ACFT: 'text-cyan-400',    // Aircraft - cyan
  SEIS: 'text-red-400',     // Seismic - red
  SATS: 'text-lime-400',    // Satellites - lime green
  SYS:  'text-amber-400',   // System - amber
  CCTV: 'text-purple-400',  // CCTV - purple
  AIS:  'text-orange-400',  // Ships/AIS - orange
};

const EVENT_BG_COLORS: Record<IntelEvent['type'], string> = {
  ACFT: 'bg-cyan-400/10',
  SEIS: 'bg-red-400/10',
  SATS: 'bg-lime-400/10',
  SYS:  'bg-amber-400/10',
  CCTV: 'bg-purple-400/10',
  AIS:  'bg-orange-400/10',
};

/**
 * IntelFeed - Real-time event stream sidebar
 * Desktop: fixed 288px right panel at top.
 * Mobile: badge button with sliding modal.
 * 6 event types with distinct colors, HH:MM:SS timestamps, 20 max entries.
 * Newest events at top, auto-scrolling.
 */
export default function IntelFeed({ events }: IntelFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLButtonElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Focus trap: traps Tab within modal, restores focus to badge on close
  useFocusTrap(modalRef, mobileOpen && !isClosing);

  // Animated close handler for mobile modal
  const handleMobileClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setMobileOpen(false);
      setIsClosing(false);
      // Restore focus to the badge trigger
      badgeRef.current?.focus();
    }, 250);
  }, []);

  const handleMobileOpen = useCallback(() => {
    setMobileOpen(true);
    setIsClosing(false);
  }, []);

  // Format timestamp as HH:MM:SS
  const formatTime = (date: Date) => {
    return date.toISOString().slice(11, 19);
  };

  // Auto-scroll to top when new events arrive (newest at top)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length]);

  // Most recent 20 entries (already sliced by addIntelEvent, but safety cap)
  const displayEvents = events.slice(0, 20);

  // Badge count excludes system messages
  const badgeCount = displayEvents.filter(e => e.type !== 'SYS').length;

  const renderEvents = () => (
    <>
      {displayEvents.map((event, idx) => {
        const typeColor = EVENT_COLORS[event.type] || 'text-white/60';
        const bgColor = EVENT_BG_COLORS[event.type] || '';
        return (
          <div
            key={event.id}
            className={`text-[10px] font-mono px-2 py-[3px] border-b border-white/5 ${bgColor} ${idx === 0 ? 'animate-pulse' : ''}`}
          >
            <span className="text-white/50">{formatTime(event.timestamp)}</span>
            <span className="text-white/20"> | </span>
            <span className={`${typeColor} font-bold`}>[{event.type}]</span>
            <span className="text-white/20"> | </span>
            <span className="text-white/70">{event.message}</span>
          </div>
        );
      })}
      {displayEvents.length === 0 && (
        <div className="text-[10px] font-mono text-white/50 text-center py-4">
          AWAITING INTEL...
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop: fixed 288px right panel at top */}
      <aside className="fixed right-0 top-0 w-72 max-h-[50vh] bg-black/85 backdrop-blur-md border-l border-b border-white/10 rounded-bl-lg z-50 hidden lg:flex flex-col pointer-events-auto" aria-label="Intel feed">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div aria-hidden="true" className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest">Intel Feed</h2>
          </div>
          <span className="text-[9px] font-mono text-white/50" aria-label={`${displayEvents.length} of 20 events`}>{displayEvents.length}/20</span>
        </div>

        {/* Scrollable event list */}
        <div ref={scrollRef} className="overflow-y-auto flex-1 min-h-0 panel-scroll" role="log" aria-live="polite" aria-label="Intelligence events" onWheel={(e) => e.stopPropagation()}>
          {renderEvents()}
        </div>
      </aside>

      {/* Mobile: badge button + sliding modal */}
      <div className="lg:hidden">
        {/* Badge button */}
        {!mobileOpen && (
          <button
            ref={badgeRef}
            onClick={handleMobileOpen}
            onTouchEnd={(e) => { e.preventDefault(); handleMobileOpen(); }}
            className="fixed top-2 right-2 z-50 bg-black/80 border border-white/20 rounded-full px-3 py-1.5 flex items-center gap-1.5 active:scale-90 transition-all duration-200 ease-out pointer-events-auto"
            aria-label="Open intel feed"
          >
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-mono text-white/80">INTEL</span>
            {badgeCount > 0 && (
              <span className="bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {badgeCount}
              </span>
            )}
          </button>
        )}

        {/* Full-screen modal with slide-in/out animation */}
        {mobileOpen && (
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Intel feed"
            className={`fixed inset-0 z-[60] flex flex-col pointer-events-auto ${isClosing ? 'backdrop-exit' : 'backdrop-enter'}`}
            style={{ backgroundColor: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
          >
            <div className={`flex flex-col h-full ${isClosing ? 'modal-exit' : 'modal-enter'}`}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <h2 className="text-sm font-bold text-white/80 uppercase tracking-widest">Intel Feed</h2>
                </div>
                <button
                  onClick={handleMobileClose}
                  onTouchEnd={(e) => { e.preventDefault(); handleMobileClose(); }}
                  className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/60 hover:text-white/90 active:scale-90 transition-all duration-150"
                  aria-label="Close intel feed"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="overflow-y-auto flex-1 panel-scroll" onWheel={(e) => e.stopPropagation()}>
                {renderEvents()}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
