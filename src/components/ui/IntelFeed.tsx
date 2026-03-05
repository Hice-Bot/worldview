import type { IntelEvent } from '../../types';

interface IntelFeedProps {
  events: IntelEvent[];
}

/**
 * IntelFeed - Real-time event stream sidebar
 * Desktop: fixed 288px right panel. Mobile: badge button with modal.
 * 6 event types with distinct colors, HH:MM:SS timestamps, 20 max entries.
 */
export default function IntelFeed({ events }: IntelFeedProps) {
  // TODO: Implement desktop right panel layout
  // TODO: Implement mobile badge button + modal
  // TODO: Implement event type color coding
  // TODO: Implement 20-entry cap with auto-scroll

  const formatTime = (date: Date) => {
    return date.toISOString().slice(11, 19);
  };

  return (
    <div className="fixed right-0 top-0 w-72 max-h-[50vh] bg-black/80 backdrop-blur-md border-l border-b border-white/10 z-50 overflow-y-auto hidden lg:block">
      <div className="p-2 border-b border-white/10">
        <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest">Intel Feed</h2>
      </div>
      <div className="p-1">
        {events.map((event) => (
          <div key={event.id} className="text-[10px] font-mono px-2 py-0.5">
            <span className="text-white/40">{formatTime(event.timestamp)}</span>
            {' '}
            <span className="text-accent font-bold">[{event.type}]</span>
            {' '}
            <span className="text-white/70">{event.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
