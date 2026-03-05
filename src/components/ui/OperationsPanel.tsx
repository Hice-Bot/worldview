import type {
  LayerState,
  ShaderMode,
  MapTileMode,
  AltitudeFilters,
  SatelliteFilters,
} from '../../types';

interface OperationsPanelProps {
  layers: LayerState;
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

/**
 * OperationsPanel - Primary control interface
 * Desktop: fixed 224px left sidebar. Mobile: FAB with modal.
 * Sections: Optics Mode, Map Tiles, Data Layers, Flight Filters,
 * Satellite Filters, Utility (Locate Me, Reset View).
 */
export default function OperationsPanel(_props: OperationsPanelProps) {
  // TODO: Implement desktop sidebar layout
  // TODO: Implement mobile FAB + modal
  // TODO: Implement optics mode buttons (STANDARD, CRT, NVG, FLIR)
  // TODO: Implement map tiles toggle (GOOGLE 3D, OSM)
  // TODO: Implement 6 layer toggles with loading indicators
  // TODO: Implement flight filters (route paths + altitude bands)
  // TODO: Implement satellite filters (orbit paths + categories)
  // TODO: Implement Locate Me and Reset View buttons
  return (
    <div className="fixed left-0 top-0 bottom-0 w-56 bg-black/80 backdrop-blur-md border-r border-white/10 z-50 overflow-y-auto hidden lg:block">
      <div className="p-3">
        <h1 className="text-xs font-bold text-white/80 uppercase tracking-widest">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2" />
          WorldView
        </h1>
      </div>
      {/* TODO: Sections will be implemented by coding agents */}
    </div>
  );
}
