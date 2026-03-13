import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Cartesian3, Math as CesiumMath } from 'cesium';
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
  LayerLoading,
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
  const { earthquakes, loading: earthquakesLoading, error: earthquakesError } = useEarthquakes(layers.earthquakes);
  const { satellites, loading: satellitesLoading, error: satellitesError } = useSatellites(layers.satellites);
  const { flights: globalFlights, loading: flightsLoading, error: flightsError } = useFlights(layers.flights);
  const { cameras, loading: cctvLoading, error: cctvError } = useCameras(layers.cctv);

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

  const { roads: trafficRoads, loading: trafficLoading, error: trafficError } = useTraffic(layers.traffic, trafficBbox);
  const { ships, loading: shipsLoading, error: shipsError } = useShips(layers.ships);

  // Aggregate loading states for UI indicators
  const layerLoading = useMemo(() => ({
    flights: flightsLoading,
    satellites: satellitesLoading,
    earthquakes: earthquakesLoading,
    traffic: trafficLoading,
    cctv: cctvLoading,
    ships: shipsLoading,
  }), [flightsLoading, satellitesLoading, earthquakesLoading, trafficLoading, cctvLoading, shipsLoading]);

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

  // =========================================================================
  // Intel events generated by data hooks for significant changes
  // =========================================================================
  const prevFlightCountRef = useRef(0);
  const prevSatCountRef = useRef(0);
  const prevQuakeIdsRef = useRef<Set<string>>(new Set());
  const prevShipCountRef = useRef(0);
  const prevCctvCountRef = useRef(0);
  const prevCctvAvailRef = useRef<Map<string, boolean>>(new Map());

  // Flight data changes — airborne count changes of 50+ trigger ACFT intel events (Feature #150)
  useEffect(() => {
    if (!booted || flights.length === 0) return;
    const airborne = flights.filter(f => !f.onGround).length;
    const prev = prevFlightCountRef.current;
    if (prev === 0 && airborne > 0) {
      addIntelEvent('ACFT', `TRACKING ${airborne.toLocaleString()} AIRCRAFT GLOBALLY`);
    } else if (Math.abs(airborne - prev) >= 50) {
      const diff = airborne - prev;
      const direction = diff > 0 ? 'INCREASED' : 'DECREASED';
      addIntelEvent('ACFT', `AIRBORNE COUNT ${direction} BY ${Math.abs(diff)} — ${airborne.toLocaleString()} AIRCRAFT`);
    }
    prevFlightCountRef.current = airborne;
  }, [flights, booted, addIntelEvent]);

  // Satellite data changes
  useEffect(() => {
    if (!booted || satellites.length === 0) return;
    const prev = prevSatCountRef.current;
    if (prev === 0 && satellites.length > 0) {
      addIntelEvent('SATS', `${satellites.length.toLocaleString()} SATELLITES LOADED — SGP4 PROPAGATING`);
    }
    prevSatCountRef.current = satellites.length;
  }, [satellites.length, booted, addIntelEvent]);

  // Earthquake data changes — generates per-earthquake SEIS events with descriptions
  useEffect(() => {
    if (!booted || earthquakes.length === 0) return;
    const prevIds = prevQuakeIdsRef.current;
    const currentIds = new Set(earthquakes.map(q => q.id));

    if (prevIds.size === 0 && earthquakes.length > 0) {
      // Initial load — report summary with strongest earthquake
      const strongest = earthquakes.reduce((a, b) => (a.magnitude > b.magnitude ? a : b));
      addIntelEvent('SEIS', `${earthquakes.length} SEISMIC EVENTS — MAX M${strongest.magnitude.toFixed(1)} ${strongest.place || ''}`);
    } else if (prevIds.size > 0) {
      // Find new earthquakes that weren't in the previous set
      const newQuakes = earthquakes.filter(q => !prevIds.has(q.id));
      // Report each new significant earthquake individually with its description
      for (const quake of newQuakes) {
        const desc = quake.place ? `M${quake.magnitude.toFixed(1)} ${quake.place}` : `M${quake.magnitude.toFixed(1)} SEISMIC EVENT`;
        addIntelEvent('SEIS', desc.toUpperCase());
      }
    }

    prevQuakeIdsRef.current = currentIds;
  }, [earthquakes, booted, addIntelEvent]);

  // Ship data changes — vessel count changes of 30+ trigger AIS events
  useEffect(() => {
    if (!booted || ships.length === 0) return;
    const prev = prevShipCountRef.current;
    if (prev === 0 && ships.length > 0) {
      addIntelEvent('AIS', `AIS FEED ACTIVE — ${ships.length.toLocaleString()} VESSELS TRACKED`);
    } else if (Math.abs(ships.length - prev) >= 30) {
      const diff = ships.length - prev;
      const direction = diff > 0 ? 'INCREASED' : 'DECREASED';
      addIntelEvent('AIS', `VESSEL COUNT ${direction} BY ${Math.abs(diff)} — ${ships.length.toLocaleString()} AIS TARGETS`);
    }
    prevShipCountRef.current = ships.length;
  }, [ships.length, booted, addIntelEvent]);

  // CCTV data changes — camera availability changes trigger CCTV intel events (Feature #151)
  useEffect(() => {
    if (!booted || cameras.length === 0) return;
    const prev = prevCctvCountRef.current;
    const prevAvail = prevCctvAvailRef.current;

    if (prev === 0 && cameras.length > 0) {
      // Initial load — report summary
      const onlineCount = cameras.filter(c => c.available).length;
      const gbCount = cameras.filter(c => c.country === 'GB').length;
      const usCount = cameras.filter(c => c.country === 'US').length;
      addIntelEvent('CCTV', `${onlineCount} CAMERAS ONLINE — GB:${gbCount} US:${usCount}`);
    } else if (prevAvail.size > 0) {
      // Detect camera availability changes (online/offline status)
      let cameOnline = 0;
      let wentOffline = 0;
      for (const cam of cameras) {
        const wasAvailable = prevAvail.get(cam.id);
        if (wasAvailable !== undefined) {
          if (!wasAvailable && cam.available) cameOnline++;
          if (wasAvailable && !cam.available) wentOffline++;
        }
      }
      if (cameOnline > 0) {
        addIntelEvent('CCTV', `${cameOnline} CAMERA${cameOnline > 1 ? 'S' : ''} CAME ONLINE`);
      }
      if (wentOffline > 0) {
        addIntelEvent('CCTV', `${wentOffline} CAMERA${wentOffline > 1 ? 'S' : ''} WENT OFFLINE`);
      }
    }

    // Update refs for next comparison
    prevCctvCountRef.current = cameras.length;
    const newAvailMap = new Map<string, boolean>();
    for (const cam of cameras) {
      newAvailMap.set(cam.id, cam.available);
    }
    prevCctvAvailRef.current = newAvailMap;
  }, [cameras, booted, addIntelEvent]);

  // Layer toggle handler
  // When flights layer is re-enabled, reset flight filters to defaults (Feature #108)
  const toggleLayer = useCallback((layer: keyof LayerState) => {
    setLayers((prev) => {
      const wasOff = !prev[layer];
      const newLayers = { ...prev, [layer]: !prev[layer] };
      // Reset flight filters to default when re-enabling flights
      if (layer === 'flights' && wasOff) {
        setAltitudeFilters({
          cruise: true,
          high: true,
          mid: true,
          low: true,
          ground: true,
        });
        setShowRoutePaths(false);
      }
      // Clear CCTV selection and tracking when disabling CCTV layer
      if (layer === 'cctv' && !wasOff) {
        setSelectedCamera(null);
        setTrackedEntity((prev) => {
          if (prev && prev.type === 'cctv') {
            // Also clear viewer camera lock-on
            const viewer = viewerRef.current;
            if (viewer && !viewer.isDestroyed()) {
              viewer.trackedEntity = undefined;
            }
            return null;
          }
          return prev;
        });
      }
      return newLayers;
    });
  }, []);

  // Track entity handler
  const handleTrackEntity = useCallback((entity: TrackedEntityInfo | null) => {
    setTrackedEntity(entity);
  }, []);

  // Reset view handler - smooth flyTo animation to default Sydney view
  const handleResetView = useCallback(() => {
    setTrackedEntity(null);
    const viewer = viewerRef.current;
    if (viewer && !viewer.isDestroyed()) {
      // Cancel any in-progress flight
      viewer.camera.cancelFlight();
      viewer.trackedEntity = undefined;
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(
          DEFAULT_CAMERA.lon,
          DEFAULT_CAMERA.lat,
          DEFAULT_CAMERA.altitude
        ),
        orientation: {
          heading: CesiumMath.toRadians(DEFAULT_CAMERA.heading),
          pitch: CesiumMath.toRadians(DEFAULT_CAMERA.pitch),
          roll: 0,
        },
        duration: 2.0,
      });
    }
  }, []);

  // Locate Me handler - uses browser geolocation API then server-side fallback
  const [locateMeState, setLocateMeState] = useState<'idle' | 'requesting' | 'success' | 'error'>('idle');
  const handleLocateMe = useCallback(() => {
    setLocateMeState('requesting');
    const viewer = viewerRef.current;

    const flyToLocation = (lat: number, lon: number, altitude: number, duration: number) => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.camera.cancelFlight();
        viewer.trackedEntity = undefined;
        setTrackedEntity(null);
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(lon, lat, altitude),
          orientation: {
            heading: CesiumMath.toRadians(0),
            pitch: CesiumMath.toRadians(-45),
            roll: 0,
          },
          duration,
          complete: () => setLocateMeState('success'),
        });
      }
    };

    // Try browser Geolocation API first
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          flyToLocation(position.coords.latitude, position.coords.longitude, 50000, 2.0);
        },
        () => {
          // Geolocation denied/unavailable — try server-side IP geolocation
          fetch('/api/geolocation')
            .then((res) => res.json())
            .then((data) => {
              if (data.lat && data.lon) {
                flyToLocation(data.lat, data.lon, 50000, 2.0);
              } else {
                // Fall back to default view if no location available
                setLocateMeState('error');
                flyToLocation(DEFAULT_CAMERA.lat, DEFAULT_CAMERA.lon, DEFAULT_CAMERA.altitude, 2.0);
              }
            })
            .catch(() => {
              setLocateMeState('error');
              flyToLocation(DEFAULT_CAMERA.lat, DEFAULT_CAMERA.lon, DEFAULT_CAMERA.altitude, 2.0);
            });
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    } else {
      // No geolocation support — try server-side
      fetch('/api/geolocation')
        .then((res) => res.json())
        .then((data) => {
          if (data.lat && data.lon) {
            flyToLocation(data.lat, data.lon, 50000, 2.0);
          } else {
            setLocateMeState('error');
            flyToLocation(DEFAULT_CAMERA.lat, DEFAULT_CAMERA.lon, DEFAULT_CAMERA.altitude, 2.0);
          }
        })
        .catch(() => {
          setLocateMeState('error');
          flyToLocation(DEFAULT_CAMERA.lat, DEFAULT_CAMERA.lon, DEFAULT_CAMERA.altitude, 2.0);
        });
    }
  }, []);

  // Auto-reset locateMeState after 3 seconds
  useEffect(() => {
    if (locateMeState === 'success' || locateMeState === 'error') {
      const timer = setTimeout(() => setLocateMeState('idle'), 3000);
      return () => clearTimeout(timer);
    }
  }, [locateMeState]);

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
        onMapTilesChange={setMapTiles}
        defaultCamera={DEFAULT_CAMERA}
      />

      {/* UI Overlays */}
      <OperationsPanel
        layers={layers}
        layerLoading={layerLoading}
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
        locateMeState={locateMeState}
        onResetView={handleResetView}
        onLocateMe={handleLocateMe}
      />

      <IntelFeed events={intelEvents} />

      <CCTVPanel
        cameras={cameras}
        selectedCamera={selectedCamera}
        onSelectCamera={setSelectedCamera}
        onFlyTo={(camera) => {
          setSelectedCamera(camera);
          // Animate globe camera to camera lat/lon with street-level directional offset
          const viewer = viewerRef.current;
          if (viewer && !viewer.isDestroyed()) {
            // Cancel any in-progress flight before starting a new one
            viewer.camera.cancelFlight();
            viewer.trackedEntity = undefined;
            setTrackedEntity(null);

            // Calculate heading based on camera's compass direction
            const COMPASS_TO_HEADING: Record<string, number> = {
              N: 0, NE: 45, E: 90, SE: 135,
              S: 180, SW: 225, W: 270, NW: 315,
            };
            const dirStr = (camera.direction || '').toUpperCase();
            const headingDeg = COMPASS_TO_HEADING[dirStr] ?? 0;

            // Street-level altitude and offset: fly to ~200m above the camera,
            // looking in the camera's direction
            const streetAltitude = 200;
            // Offset the destination slightly behind the camera's facing direction
            // so the viewer sees what the camera sees
            const offsetDist = 0.001; // ~100m in degrees
            const headingRad = CesiumMath.toRadians(headingDeg + 180); // opposite direction (behind camera)
            const offsetLat = camera.lat + offsetDist * Math.cos(headingRad);
            const offsetLon = camera.lon + offsetDist * Math.sin(headingRad);

            viewer.camera.flyTo({
              destination: Cartesian3.fromDegrees(offsetLon, offsetLat, streetAltitude),
              orientation: {
                heading: CesiumMath.toRadians(headingDeg),
                pitch: CesiumMath.toRadians(-25), // Slight downward angle for street view
                roll: 0,
              },
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
