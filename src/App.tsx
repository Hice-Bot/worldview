import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Cartesian3 } from 'cesium';
import type { Viewer as CesiumViewer } from 'cesium';
import GlobeViewer from './components/globe/GlobeViewer';
import OperationsPanel from './components/ui/OperationsPanel';
import IntelFeed from './components/ui/IntelFeed';
import StatusBar from './components/ui/StatusBar';
import CCTVPanel from './components/ui/CCTVPanel';
import TrackedEntityPanel from './components/ui/TrackedEntityPanel';
import Crosshair from './components/ui/Crosshair';
import { useEarthquakes } from './hooks/useEarthquakes';
import { useSatellites } from './hooks/useSatellites';
import { useFlights } from './hooks/useFlights';
import { useFlightsLive } from './hooks/useFlightsLive';
import { useCameras } from './hooks/useCameras';
import { useTraffic } from './hooks/useTraffic';
import { useShips } from './hooks/useShips';
import type {
  LayerState,
  ShaderMode,
  MapTileMode,
  CameraState,
  TrackedEntityInfo,
  AltitudeFilters,
  SatelliteFilters,
  IntelEvent,
  CameraData,
} from './types';

const DEFAULT_CAMERA: CameraState = {
  lat: -33.8688,
  lon: 151.2093,
  altitude: 20_000_000,
  heading: 0,
  pitch: -90,
};

export default function App() {
  const viewerRef = useRef<CesiumViewer | null>(null);

  // Layer visibility state
  const [layers, setLayers] = useState<LayerState>({
    flights: true,
    satellites: false,
    earthquakes: false,
    traffic: false,
    cctv: false,
    ships: false,
  });

  // Display state
  const [shaderMode, setShaderMode] = useState<ShaderMode>('STANDARD');
  const [mapTiles, setMapTiles] = useState<MapTileMode>('GOOGLE_3D');
  const [cameraState, setCameraState] = useState<CameraState>(DEFAULT_CAMERA);
  const [trackedEntity, setTrackedEntity] = useState<TrackedEntityInfo | null>(null);

  // Filters
  const [altitudeFilters, setAltitudeFilters] = useState<AltitudeFilters>({
    cruise: true,
    high: true,
    mid: true,
    low: true,
    ground: true,
  });
  const [satelliteFilters, setSatelliteFilters] = useState<SatelliteFilters>({
    iss: true,
    other: true,
    showPaths: false,
  });
  const [showRoutePaths, setShowRoutePaths] = useState(false);

  // Data state — hooks for layers that have been implemented
  const { earthquakes } = useEarthquakes(layers.earthquakes);
  const { satellites } = useSatellites(layers.satellites);
  const { flights: globalFlights } = useFlights(layers.flights);
  const { cameras } = useCameras(layers.cctv);

  // Live regional flights - only active when zoomed in (altitude < 500km)
  const liveEnabled = layers.flights && cameraState.altitude < 500_000;
  const { flights: liveFlights } = useFlightsLive(
    liveEnabled,
    cameraState.lat,
    cameraState.lon,
    Math.max(50, Math.min(250, Math.round(cameraState.altitude / 2000)))
  );

  // Merge global + live flights, deduplicating by ICAO24 (live replaces global for nearby aircraft)
  const flights = useMemo(() => {
    if (!liveEnabled || liveFlights.length === 0) return globalFlights;
    const liveMap = new Map<string, boolean>();
    for (const lf of liveFlights) {
      if (lf.icao24) liveMap.set(lf.icao24, true);
    }
    // Keep global flights that are NOT in the live set, then add all live flights
    const filtered = globalFlights.filter((gf) => !liveMap.has(gf.icao24));
    return [...filtered, ...liveFlights];
  }, [globalFlights, liveFlights, liveEnabled]);

  // Compute bounding box from camera state for traffic data
  // Auto-disables above 5,000,000m altitude (Feature #74)
  const trafficBbox = useMemo(() => {
    if (cameraState.altitude > 5_000_000) return null; // Auto-disable at high altitude
    // Approximate bbox from camera center + altitude-based spread
    // ~0.01 degrees per 1000m altitude for reasonable road coverage
    const spread = Math.min(Math.max(cameraState.altitude * 0.00001, 0.005), 2.0);
    return {
      south: cameraState.lat - spread,
      west: cameraState.lon - spread,
      north: cameraState.lat + spread,
      east: cameraState.lon + spread,
    };
  }, [cameraState.lat, cameraState.lon, cameraState.altitude]);

  const { roads: trafficRoads } = useTraffic(layers.traffic, trafficBbox);
  const { ships } = useShips(layers.ships);

  // UI state
  const [intelEvents, setIntelEvents] = useState<IntelEvent[]>([]);
  const [booted, setBooted] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<CameraData | null>(null);

  // Intel feed helper
  const addIntelEvent = useCallback((type: IntelEvent['type'], message: string) => {
    setIntelEvents((prev) => [
      {
        id: Date.now().toString(),
        type,
        message,
        timestamp: new Date(),
      },
      ...prev,
    ].slice(0, 20));
  }, []);

  // Boot sequence
  useEffect(() => {
    if (!booted) {
      addIntelEvent('SYS', 'WORLDVIEW SYSTEM INITIALIZING...');
      setTimeout(() => addIntelEvent('SYS', 'CESIUM ENGINE LOADING...'), 500);
      setTimeout(() => addIntelEvent('SYS', 'DATA PROXY CONNECTION ESTABLISHED'), 1000);
      setTimeout(() => {
        addIntelEvent('SYS', 'DISPLAY ONLINE — ALL SYSTEMS NOMINAL');
        setBooted(true);
      }, 1500);
    }
  }, [booted, addIntelEvent]);

  // Layer toggle handler
  const toggleLayer = useCallback((layer: keyof LayerState) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  // Track entity handler
  const handleTrackEntity = useCallback((entity: TrackedEntityInfo | null) => {
    setTrackedEntity(entity);
  }, []);

  // Reset view handler
  const handleResetView = useCallback(() => {
    setCameraState(DEFAULT_CAMERA);
    setTrackedEntity(null);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      {/* 3D Globe */}
      <GlobeViewer
        ref={viewerRef}
        mapTiles={mapTiles}
        shaderMode={shaderMode}
        layers={layers}
        flights={flights}
        satellites={satellites}
        earthquakes={earthquakes}
        ships={ships}
        cameras={cameras}
        trafficRoads={trafficRoads}
        altitudeFilters={altitudeFilters}
        satelliteFilters={satelliteFilters}
        showRoutePaths={showRoutePaths}
        trackedEntity={trackedEntity}
        selectedCamera={selectedCamera}
        onCameraChange={setCameraState}
        onTrackEntity={handleTrackEntity}
        onCctvClick={setSelectedCamera}
        defaultCamera={DEFAULT_CAMERA}
      />

      {/* UI Overlays */}
      <OperationsPanel
        layers={layers}
        shaderMode={shaderMode}
        mapTiles={mapTiles}
        altitudeFilters={altitudeFilters}
        satelliteFilters={satelliteFilters}
        showRoutePaths={showRoutePaths}
        onToggleLayer={toggleLayer}
        onShaderChange={setShaderMode}
        onMapTilesChange={setMapTiles}
        onAltitudeFilterChange={setAltitudeFilters}
        onSatelliteFilterChange={setSatelliteFilters}
        onShowRoutePathsChange={setShowRoutePaths}
        onResetView={handleResetView}
        onLocateMe={() => {/* TODO: implement geolocation */}}
      />

      <IntelFeed events={intelEvents} />

      <CCTVPanel
        cameras={cameras}
        selectedCamera={selectedCamera}
        onSelectCamera={setSelectedCamera}
        onFlyTo={(camera) => {
          setSelectedCamera(camera);
          // Animate globe camera to camera lat/lon
          const viewer = viewerRef.current;
          if (viewer && !viewer.isDestroyed()) {
            viewer.camera.flyTo({
              destination: Cartesian3.fromDegrees(camera.lon, camera.lat, 2000),
              duration: 1.5,
            });
          }
        }}
      />

      <StatusBar
        cameraState={cameraState}
        shaderMode={shaderMode}
        flightCount={flights.length}
        satelliteCount={satellites.length}
        earthquakeCount={earthquakes.length}
        cctvCount={cameras.length}
        shipCount={ships.length}
      />

      {trackedEntity && (
        <TrackedEntityPanel
          entity={trackedEntity}
          onClose={() => setTrackedEntity(null)}
        />
      )}

      <Crosshair />
    </div>
  );
}
