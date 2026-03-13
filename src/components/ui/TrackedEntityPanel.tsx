import type { TrackedEntityInfo } from '../../types';

interface TrackedEntityPanelProps {
  entity: TrackedEntityInfo;
  onClose: () => void;
}

/** Safely get a string value from data, returning fallback if missing */
function str(val: unknown, fallback = '—'): string {
  if (val === undefined || val === null || val === '' || val === 'undefined') return fallback;
  return String(val);
}

/** Format a number with specified decimals, returning '—' if not available */
function fmt(val: unknown, decimals = 0): string {
  if (val === undefined || val === null || val === '' || val === 'undefined') return '—';
  const n = Number(val);
  return isNaN(n) ? String(val) : n.toFixed(decimals);
}

/** Check if data field has a meaningful value */
function has(val: unknown): boolean {
  return val !== undefined && val !== null && val !== '' && val !== 'undefined';
}

/** Aircraft-specific detail view */
function AircraftDetails({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="text-[10px] text-white/60 font-mono space-y-0.5">
      <div className="grid grid-cols-2 gap-x-3">
        <div><span className="text-white/40">CALLSIGN </span><span className="text-cyan-400 font-bold">{str(data.callsign)}</span></div>
        <div><span className="text-white/40">ICAO24 </span><span className="text-white/80">{str(data.icao24)}</span></div>
      </div>
      {has(data.registration) && (
        <div><span className="text-white/40">REG </span><span className="text-white/80">{str(data.registration)}</span></div>
      )}
      <div className="grid grid-cols-2 gap-x-3 mt-1">
        <div><span className="text-white/40">ALT </span><span className="text-white/80">{fmt(data.altitudeFeet, 0)} ft</span></div>
        <div><span className="text-white/40">SPD </span><span className="text-white/80">{fmt(data.velocityKnots, 0)} kts</span></div>
      </div>
      <div className="grid grid-cols-2 gap-x-3">
        <div><span className="text-white/40">HDG </span><span className="text-white/80">{fmt(data.heading, 0)}&deg;</span></div>
        <div><span className="text-white/40">VS </span><span className="text-white/80">{fmt(data.verticalRate, 0)} ft/m</span></div>
      </div>
      {(has(data.origin) || has(data.destination)) && (
        <div className="mt-1 border-t border-white/10 pt-1">
          <span className="text-white/40">ROUTE </span>
          <span className="text-green-400">{str(data.origin, '???')}</span>
          <span className="text-white/30">{' \u2192 '}</span>
          <span className="text-green-400">{str(data.destination, '???')}</span>
        </div>
      )}
    </div>
  );
}

/** Satellite-specific detail view */
function SatelliteDetails({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="text-[10px] text-white/60 font-mono space-y-0.5">
      <div><span className="text-white/40">NORAD ID </span><span className="text-cyan-400 font-bold">{str(data.noradId) !== '—' ? str(data.noradId) : str(data.norad)}</span></div>
      {has(data.category) && (
        <div><span className="text-white/40">GROUP </span><span className="text-white/80">{str(data.category).toUpperCase()}</span></div>
      )}
    </div>
  );
}

/** Ship-specific detail view */
function ShipDetails({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="text-[10px] text-white/60 font-mono space-y-0.5">
      <div className="grid grid-cols-2 gap-x-3">
        <div><span className="text-white/40">MMSI </span><span className="text-cyan-400 font-bold">{str(data.mmsi)}</span></div>
        <div><span className="text-white/40">IMO </span><span className="text-white/80">{str(data.imo)}</span></div>
      </div>
      {has(data.callSign) && (
        <div><span className="text-white/40">CALL SIGN </span><span className="text-white/80">{str(data.callSign)}</span></div>
      )}
      <div className="grid grid-cols-2 gap-x-3 mt-1">
        <div><span className="text-white/40">SOG </span><span className="text-white/80">{fmt(data.sog, 1)} kts</span></div>
        <div><span className="text-white/40">COG </span><span className="text-white/80">{fmt(data.cog, 0)}&deg;</span></div>
      </div>
      <div><span className="text-white/40">HDG </span><span className="text-white/80">{fmt(data.heading, 0)}&deg;</span></div>
      {has(data.destination) && (
        <div className="mt-1 border-t border-white/10 pt-1">
          <span className="text-white/40">DEST </span>
          <span className="text-green-400">{str(data.destination)}</span>
        </div>
      )}
    </div>
  );
}

/** Earthquake-specific detail view */
function EarthquakeDetails({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="text-[10px] text-white/60 font-mono space-y-0.5">
      <div><span className="text-white/40">MAG </span><span className="text-orange-400 font-bold">{'M'}{fmt(data.magnitude, 1)}</span></div>
      <div><span className="text-white/40">DEPTH </span><span className="text-white/80">{fmt(data.depth, 1)} km</span></div>
      {has(data.place) && (
        <div><span className="text-white/40">LOC </span><span className="text-white/80">{str(data.place)}</span></div>
      )}
      {has(data.time) && (
        <div><span className="text-white/40">TIME </span><span className="text-white/80">{new Date(Number(data.time)).toISOString().replace('T', ' ').slice(0, 19)}{'Z'}</span></div>
      )}
    </div>
  );
}

/** Generic fallback detail view */
function GenericDetails({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="text-[10px] text-white/60 font-mono space-y-0.5">
      {Object.entries(data).map(([key, value]) => (
        <div key={key}>
          <span className="text-white/40 uppercase">{key}{': '}</span>
          <span className="text-white/80">{String(value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Type badge color mapping */
const TYPE_COLORS: Record<string, string> = {
  aircraft: 'text-cyan-400',
  satellite: 'text-lime-400',
  ship: 'text-blue-400',
  earthquake: 'text-orange-400',
  cctv: 'text-amber-400',
};

/**
 * TrackedEntityPanel - Detail view for camera-locked entity
 * Shows type-specific information (aircraft, satellite, ship, earthquake, cctv).
 * Fixed panel positioned next to the OperationsPanel sidebar.
 */
export default function TrackedEntityPanel({ entity, onClose }: TrackedEntityPanelProps) {
  const typeColor = TYPE_COLORS[entity.type] || 'text-white';

  return (
    <div className="fixed left-60 top-4 w-72 bg-black/90 backdrop-blur-md border border-white/10 rounded-lg z-50 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-bold uppercase tracking-widest ${typeColor}`}>
          {entity.type}{' TRACKING'}
        </span>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white text-xs"
        >
          {'ESC'}
        </button>
      </div>
      <div className="text-sm text-white font-bold mb-1">{entity.name}</div>
      {entity.type === 'aircraft' && <AircraftDetails data={entity.data} />}
      {entity.type === 'satellite' && <SatelliteDetails data={entity.data} />}
      {entity.type === 'ship' && <ShipDetails data={entity.data} />}
      {entity.type === 'earthquake' && <EarthquakeDetails data={entity.data} />}
      {entity.type !== 'aircraft' && entity.type !== 'satellite' && entity.type !== 'ship' && entity.type !== 'earthquake' && (
        <GenericDetails data={entity.data} />
      )}
    </div>
  );
}
