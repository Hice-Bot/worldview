import type { TrackedEntityInfo } from '../../types';

interface TrackedEntityPanelProps {
  entity: TrackedEntityInfo;
  onClose: () => void;
}

/**
 * TrackedEntityPanel - Detail view for camera-locked entity
 * Shows type-specific information (aircraft, satellite, ship, earthquake).
 * Floating panel near tracked entity or fixed side panel.
 */
export default function TrackedEntityPanel({ entity, onClose }: TrackedEntityPanelProps) {
  // TODO: Implement type-specific detail views
  // TODO: Aircraft: callsign, ICAO24, registration, altitude, speed, heading, vrate, origin, dest
  // TODO: Satellite: name, NORAD ID, altitude, orbit info
  // TODO: Ship: name, MMSI, IMO, call sign, speed, heading, destination, type
  // TODO: Earthquake: magnitude, depth, location, time

  return (
    <div className="fixed left-60 top-4 w-72 bg-black/90 backdrop-blur-md border border-white/10 rounded-lg z-50 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-accent uppercase tracking-widest">
          {entity.type} TRACKING
        </span>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white text-xs"
        >
          ESC
        </button>
      </div>
      <div className="text-sm text-white font-bold mb-1">{entity.name}</div>
      <div className="text-[10px] text-white/60 font-mono space-y-0.5">
        {Object.entries(entity.data).map(([key, value]) => (
          <div key={key}>
            <span className="text-white/40 uppercase">{key}: </span>
            <span className="text-white/80">{String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
