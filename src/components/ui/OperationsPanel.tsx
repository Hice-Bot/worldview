import { useState, useCallback, useRef } from 'react';
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
  layerErrors?: Record<keyof LayerState, string | null>;
  shaderMode: ShaderMode;
  mapTiles: MapTileMode;
  altitudeFilters: AltitudeFilters;
  satelliteFilters: SatelliteFilters;
  showRoutePaths: boolean;
  locateMeState?: 'idle' | 'requesting' | 'success' | 'error';
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
 * Shared panel content rendered in both desktop sidebar and mobile modal.
 */
function PanelContent(props: {
  layers: LayerState;
  layerLoading?: LayerLoading;
  layerErrors?: Record<keyof LayerState, string | null>;
  shaderMode: ShaderMode;
  mapTiles: MapTileMode;
  altitudeFilters: AltitudeFilters;
  satelliteFilters: SatelliteFilters;
  showRoutePaths: boolean;
  locateMeState: 'idle' | 'requesting' | 'success' | 'error';
  onToggleLayer: (layer: keyof LayerState) => void;
  onShaderChange: (mode: ShaderMode) => void;
  onMapTilesChange: (mode: MapTileMode) => void;
  onAltitudeFilterChange: (filters: AltitudeFilters) => void;
  onSatelliteFilterChange: (filters: SatelliteFilters) => void;
  onShowRoutePathsChange: (show: boolean) => void;
  onResetView: () => void;
  onLocateMe: () => void;
}) {
  const {
    layers,
    layerLoading,
    layerErrors,
    shaderMode,
    mapTiles,
    altitudeFilters,
    satelliteFilters,
    showRoutePaths,
    locateMeState,
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
    <>
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
          const hasError = !!(layerErrors?.[key]);
          return (
            <button
              key={key}
              onClick={() => onToggleLayer(key)}
              className={`
                w-full flex items-center gap-2 px-2 py-1.5 rounded border text-left transition-all
                ${isActive
                  ? hasError
                    ? 'bg-red-500/10 border-red-400/30 text-white/90'
                    : 'bg-white/10 border-white/20 text-white/90'
                  : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60'
                }
              `}
            >
              <span
                className={`
                  w-2 h-2 rounded-full transition-all
                  ${isActive
                    ? hasError
                      ? 'bg-red-500 animate-pulse'
                      : `${color}${isLoading ? ' animate-pulse' : ''}`
                    : 'bg-white/20'
                  }
                `}
              />
              <span className="text-[10px] font-bold uppercase tracking-wider flex-1">
                {label}
              </span>
              {isActive && isLoading && !hasError && (
                <span className="text-[8px] text-white/40 uppercase">loading</span>
              )}
              {isActive && hasError && (
                <span className="text-[8px] text-red-400 uppercase">error</span>
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
          disabled={locateMeState === 'requesting'}
          className={`
            w-full flex items-center gap-2 px-2 py-1.5 rounded border transition-all
            ${locateMeState === 'requesting'
              ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300 cursor-wait'
              : locateMeState === 'success'
              ? 'bg-green-500/20 border-green-400/40 text-green-300'
              : locateMeState === 'error'
              ? 'bg-red-500/20 border-red-400/40 text-red-300'
              : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
            }
          `}
        >
          <svg className={`w-3 h-3 ${locateMeState === 'requesting' ? 'animate-pulse' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider">
            {locateMeState === 'requesting' ? 'Locating...' : locateMeState === 'success' ? 'Located!' : locateMeState === 'error' ? 'Default View' : 'Locate Me'}
          </span>
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
    </>
  );
}

/**
 * OperationsPanel - Primary control interface
 * Desktop: fixed 224px left sidebar. Mobile: FAB with full-screen modal.
 * Sections: Optics Mode, Map Tiles, Data Layers, Flight Filters,
 * Satellite Filters, Utility (Locate Me, Reset View).
 */
export default function OperationsPanel(props: OperationsPanelProps) {
  const {
    layers,
    layerLoading,
    layerErrors,
    shaderMode,
    mapTiles,
    altitudeFilters,
    satelliteFilters,
    showRoutePaths,
    locateMeState = 'idle',
    onToggleLayer,
    onShaderChange,
    onMapTilesChange,
    onAltitudeFilterChange,
    onSatelliteFilterChange,
    onShowRoutePathsChange,
    onResetView,
    onLocateMe,
  } = props;

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Animated close handler - play exit animation then unmount
  const handleClose = useCallback(() => {
    setIsClosing(true);
    // Wait for animation to complete before unmounting
    setTimeout(() => {
      setMobileOpen(false);
      setIsClosing(false);
    }, 250); // matches modal-exit duration
  }, []);

  const handleOpen = useCallback(() => {
    setMobileOpen(true);
    setIsClosing(false);
  }, []);

  // Count active layers for FAB badge
  const activeLayerCount = Object.values(layers).filter(Boolean).length;

  const contentProps = {
    layers,
    layerLoading,
    layerErrors,
    shaderMode,
    mapTiles,
    altitudeFilters,
    satelliteFilters,
    showRoutePaths,
    locateMeState,
    onToggleLayer,
    onShaderChange,
    onMapTilesChange,
    onAltitudeFilterChange,
    onSatelliteFilterChange,
    onShowRoutePathsChange,
    onResetView,
    onLocateMe,
  };

  return (
    <>
      {/* ===== DESKTOP: fixed 224px left sidebar (1024px+) ===== */}
      <div className="fixed left-0 top-0 bottom-8 w-56 bg-black/80 backdrop-blur-md border-r border-white/10 rounded-br-lg z-50 overflow-y-auto hidden lg:block pointer-events-auto panel-scroll" onWheel={(e) => e.stopPropagation()}>
        {/* Header with pulsing green indicator */}
        <div className="p-3 border-b border-white/10">
          <h1 className="text-xs font-bold text-white/80 uppercase tracking-widest flex items-center">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2" />
            WorldView
          </h1>
        </div>

        <PanelContent {...contentProps} />
      </div>

      {/* ===== MOBILE: FAB + full-screen modal (below 1024px) ===== */}
      <div className="lg:hidden">
        {/* Floating Action Button - bottom-left for easy thumb access */}
        {!mobileOpen && (
          <button
            onClick={handleOpen}
            onTouchEnd={(e) => { e.preventDefault(); handleOpen(); }}
            className="fixed left-4 bottom-12 z-50 w-12 h-12 rounded-full bg-black/80 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg shadow-black/50 active:scale-90 transition-all duration-200 ease-out pointer-events-auto"
            aria-label="Open operations panel"
          >
            {/* Stacked bars icon representing layers/controls */}
            <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            {/* Active layer count badge */}
            {activeLayerCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-green-500 text-black text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {activeLayerCount}
              </span>
            )}
          </button>
        )}

        {/* Full-screen modal with slide-in/out animation */}
        {mobileOpen && (
          <div
            ref={modalRef}
            className={`fixed inset-0 z-[60] flex flex-col pointer-events-auto ${isClosing ? 'backdrop-exit' : 'backdrop-enter'}`}
            style={{ backgroundColor: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
          >
            <div className={`flex flex-col h-full ${isClosing ? 'modal-exit' : 'modal-enter'}`}>
              {/* Modal header with close button */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                <h1 className="text-xs font-bold text-white/80 uppercase tracking-widest flex items-center">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2" />
                  WorldView
                </h1>
                <button
                  onClick={handleClose}
                  onTouchEnd={(e) => { e.preventDefault(); handleClose(); }}
                  className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/60 hover:text-white/90 active:scale-90 transition-all duration-150"
                  aria-label="Close operations panel"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable panel content */}
              <div className="flex-1 overflow-y-auto min-h-0 panel-scroll" onWheel={(e) => e.stopPropagation()}>
                <PanelContent {...contentProps} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
