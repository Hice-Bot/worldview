import { useRef, useEffect, useState } from 'react';
import type { IntelEvent } from '../../types';

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
  const [mobileOpen, setMobileOpen] = useState(false);

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
            <span className="text-white/40">{formatTime(event.timestamp)}</span>
            <span className="text-white/20"> | </span>
            <span className={`${typeColor} font-bold`}>[{event.type}]</span>
            <span className="text-white/20"> | </span>
            <span className="text-white/70">{event.message}</span>
          </div>
        );
      })}
      {displayEvents.length === 0 && (
        <div className="text-[10px] font-mono text-white/30 text-center py-4">
          AWAITING INTEL...
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop: fixed 288px right panel at top */}
      <div className="fixed right-0 top-0 w-72 max-h-[50vh] bg-black/85 backdrop-blur-md border-l border-b border-white/10 z-50 hidden lg:flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest">Intel Feed</h2>
          </div>
          <span className="text-[9px] font-mono text-white/30">{displayEvents.length}/20</span>
        </div>

        {/* Scrollable event list */}
        <div ref={scrollRef} className="overflow-y-auto flex-1 min-h-0">
          {renderEvents()}
        </div>
      </div>

      {/* Mobile: badge button + sliding modal */}
      <div className="lg:hidden">
        {/* Badge button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="fixed top-2 right-2 z-50 bg-black/80 border border-white/20 rounded-full px-3 py-1.5 flex items-center gap-1.5"
        >
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-mono text-white/80">INTEL</span>
          {displayEvents.length > 0 && (
            <span className="bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {displayEvents.length}
            </span>
          )}
        </button>

        {/* Full-screen modal */}
        {mobileOpen && (
          <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <h2 className="text-sm font-bold text-white/80 uppercase tracking-widest">Intel Feed</h2>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-white/60 text-lg px-2"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {renderEvents()}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
