import type {
  LayerState,
  LayerLoading,
  ShaderMode,
  MapTileMode,
  AltitudeFilters,
  SatelliteFilters,
} from '../../types';

interface OperationsPanelProps {
  layers: LayerState;
  layerLoading?: LayerLoading;
  shaderMode: ShaderMode;
  mapTiles: MapTileMode;
  altitudeFilters: AltitudeFilters;
  satelliteFilters: SatelliteFilters;
  showRoutePaths: boolean;
  onToggleLayer: (layer: keyof LayerState) => void;
  onShaderChange: (mode: ShaderMode) => void;
  onMapTilesChange: (mode: MapTileMode) => void;
  onAltitudeFilterChange: (filters: AltitudeFilters) => void;
  onSatelliteFilterChange: (filters: SatelliteFilters) => void;
  onShowRoutePathsChange: (show: boolean) => void;
  onResetView: () => void;
  onLocateMe: () => void;
}

// Section label component
function SectionLabel({ children }: { children: string }) {
  return (
    <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-4 mb-2 px-3">
      {children}
    </div>
  );
}

// Shader mode button color coding
const SHADER_COLORS: Record<ShaderMode, { active: string; text: string }> = {
  STANDARD: { active: 'bg-white/20 border-white/40', text: 'text-white' },
  CRT: { active: 'bg-amber-500/30 border-amber-400/60', text: 'text-amber-400' },
  NVG: { active: 'bg-green-500/30 border-green-400/60', text: 'text-green-400' },
  FLIR: { active: 'bg-red-500/30 border-red-400/60', text: 'text-red-400' },
};

// Layer config for rendering toggles
const LAYER_CONFIG: { key: keyof LayerState; label: string; color: string }[] = [
  { key: 'flights', label: 'Live Flights', color: 'bg-cyan-400' },
  { key: 'satellites', label: 'Satellites', color: 'bg-green-400' },
  { key: 'earthquakes', label: 'Seismic', color: 'bg-amber-400' },
  { key: 'traffic', label: 'Street Traffic', color: 'bg-yellow-400' },
  { key: 'cctv', label: 'CCTV Feeds', color: 'bg-red-400' },
  { key: 'ships', label: 'Naval/AIS', color: 'bg-blue-400' },
];

// Altitude band config
const ALTITUDE_BANDS: { key: keyof AltitudeFilters; label: string; color: string }[] = [
  { key: 'cruise', label: 'Cruise', color: 'bg-cyan-400' },
  { key: 'high', label: 'High', color: 'bg-sky-300' },
  { key: 'mid', label: 'Mid', color: 'bg-yellow-400' },
  { key: 'low', label: 'Low', color: 'bg-orange-400' },
  { key: 'ground', label: 'Ground', color: 'bg-red-500' },
];

/**
 * OperationsPanel - Primary control interface
 * Desktop: fixed 224px left sidebar. Mobile: FAB with modal.
 * Sections: Optics Mode, Map Tiles, Data Layers, Flight Filters,
 * Satellite Filters, Utility (Locate Me, Reset View).
 */
export default function OperationsPanel(props: OperationsPanelProps) {
  const {
    layers,
    layerLoading,
    shaderMode,
    mapTiles,
    altitudeFilters,
    satelliteFilters,
    showRoutePaths,
    onToggleLayer,
    onShaderChange,
    onMapTilesChange,
    onAltitudeFilterChange,
    onSatelliteFilterChange,
    onShowRoutePathsChange,
    onResetView,
    onLocateMe,
  } = props;

  return (
    <div className="fixed left-0 top-0 bottom-0 w-56 bg-black/80 backdrop-blur-md border-r border-white/10 z-50 overflow-y-auto hidden lg:block">
      {/* Header with pulsing green indicator */}
      <div className="p-3 border-b border-white/10">
        <h1 className="text-xs font-bold text-white/80 uppercase tracking-widest flex items-center">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2" />
          WorldView
        </h1>
      </div>

      {/* === OPTICS MODE === */}
      <SectionLabel>Optics Mode</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5 px-3">
        {(['STANDARD', 'CRT', 'NVG', 'FLIR'] as ShaderMode[]).map((mode) => {
          const isActive = shaderMode === mode;
          const colors = SHADER_COLORS[mode];
          return (
            <button
              key={mode}
              onClick={() => onShaderChange(mode)}
              className={`
                px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border transition-all
                ${isActive
                  ? `${colors.active} ${colors.text}`
                  : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60'
                }
              `}
            >
              {mode}
            </button>
          );
        })}
      </div>

      {/* === MAP TILES === */}
      <SectionLabel>Map Tiles</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5 px-3">
        <button
          onClick={() => onMapTilesChange('GOOGLE_3D')}
          className={`
            px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border transition-all
            ${mapTiles === 'GOOGLE_3D'
              ? 'bg-blue-500/30 border-blue-400/60 text-blue-300'
              : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60'
            }
          `}
        >
          Google 3D
        </button>
        <button
          onClick={() => onMapTilesChange('OSM')}
          className={`
            px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border transition-all
            ${mapTiles === 'OSM'
              ? 'bg-blue-500/30 border-blue-400/60 text-blue-300'
              : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60'
            }
          `}
        >
          OSM
        </button>
      </div>

      {/* === DATA LAYERS === */}
      <SectionLabel>Data Layers</SectionLabel>
      <div className="space-y-1 px-3">
        {LAYER_CONFIG.map(({ key, label, color }) => {
          const isActive = layers[key];
          const isLoading = layerLoading?.[key] ?? false;
          return (
            <button
              key={key}
              onClick={() => onToggleLayer(key)}
              className={`
                w-full flex items-center gap-2 px-2 py-1.5 rounded border text-left transition-all
                ${isActive
                  ? 'bg-white/10 border-white/20 text-white/90'
                  : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60'
                }
              `}
            >
              <span
                className={`
                  w-2 h-2 rounded-full transition-all
                  ${isActive ? `${color}${isLoading ? ' animate-pulse' : ''}` : 'bg-white/20'}
                `}
              />
              <span className="text-[10px] font-bold uppercase tracking-wider flex-1">
                {label}
              </span>
              {isActive && isLoading && (
                <span className="text-[8px] text-white/40 uppercase">loading</span>
              )}
            </button>
          );
        })}
      </div>

      {/* === FLIGHT FILTERS (conditional) === */}
      {layers.flights && (
        <>
          <SectionLabel>Flight Filters</SectionLabel>
          <div className="space-y-1.5 px-3">
            {/* Route Paths toggle */}
            <button
              onClick={() => onShowRoutePathsChange(!showRoutePaths)}
              className={`
                w-full flex items-center gap-2 px-2 py-1.5 rounded border text-left transition-all
                ${showRoutePaths
                  ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300'
                  : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60'
                }
              `}
            >
              <span className={`w-2 h-2 rounded-full ${showRoutePaths ? 'bg-cyan-400' : 'bg-white/20'}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Route Paths</span>
            </button>

            {/* Altitude band buttons */}
            <div className="grid grid-cols-5 gap-1">
              {ALTITUDE_BANDS.map(({ key, label, color }) => {
                const isActive = altitudeFilters[key];
                return (
                  <button
                    key={key}
                    onClick={() =>
                      onAltitudeFilterChange({
                        ...altitudeFilters,
                        [key]: !altitudeFilters[key],
                      })
                    }
                    className={`
                      flex flex-col items-center gap-0.5 px-1 py-1 rounded border text-center transition-all
                      ${isActive
                        ? 'bg-white/10 border-white/20 text-white/90'
                        : 'bg-white/5 border-white/10 text-white/30 hover:bg-white/10'
                      }
                    `}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${isActive ? color : 'bg-white/20'}`}
                    />
                    <span className="text-[8px] font-bold uppercase leading-none">
                      {label.slice(0, 3)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* === SATELLITE FILTERS (conditional) === */}
      {layers.satellites && (
        <>
          <SectionLabel>Satellite Filters</SectionLabel>
          <div className="space-y-1.5 px-3">
            {/* Orbit Paths toggle */}
            <button
              onClick={() =>
                onSatelliteFilterChange({
                  ...satelliteFilters,
                  showPaths: !satelliteFilters.showPaths,
                })
              }
              className={`
                w-full flex items-center gap-2 px-2 py-1.5 rounded border text-left transition-all
                ${satelliteFilters.showPaths
                  ? 'bg-green-500/20 border-green-400/40 text-green-300'
                  : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60'
                }
              `}
            >
              <span className={`w-2 h-2 rounded-full ${satelliteFilters.showPaths ? 'bg-green-400' : 'bg-white/20'}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Orbit Paths</span>
            </button>

            {/* Category filters */}
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() =>
                  onSatelliteFilterChange({
                    ...satelliteFilters,
                    iss: !satelliteFilters.iss,
                  })
                }
                className={`
                  flex items-center gap-1.5 px-2 py-1.5 rounded border text-left transition-all
                  ${satelliteFilters.iss
                    ? 'bg-yellow-500/20 border-yellow-400/40 text-yellow-300'
                    : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                  }
                `}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${satelliteFilters.iss ? 'bg-yellow-400' : 'bg-white/20'}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider">ISS</span>
              </button>
              <button
                onClick={() =>
                  onSatelliteFilterChange({
                    ...satelliteFilters,
                    other: !satelliteFilters.other,
                  })
                }
                className={`
                  flex items-center gap-1.5 px-2 py-1.5 rounded border text-left transition-all
                  ${satelliteFilters.other
                    ? 'bg-green-500/20 border-green-400/40 text-green-300'
                    : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                  }
                `}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${satelliteFilters.other ? 'bg-green-400' : 'bg-white/20'}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Other</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* === UTILITY === */}
      <SectionLabel>Utility</SectionLabel>
      <div className="space-y-1 px-3 pb-4">
        <button
          onClick={onLocateMe}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded border bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80 transition-all"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider">Locate Me</span>
        </button>
        <button
          onClick={onResetView}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded border bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80 transition-all"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 1 9 9M3 12V3m0 9h9" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider">Reset View</span>
        </button>
      </div>
    </div>
  );
}
