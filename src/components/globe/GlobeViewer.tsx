import { forwardRef, useEffect, useRef, useImperativeHandle, useState, useCallback } from 'react';
import { Viewer, Globe, Scene } from 'resium';
import {
  Viewer as CesiumViewer,
  Ion,
  Color,
  Math as CesiumMath,
  RequestScheduler,
  createGooglePhotorealistic3DTileset,
  OpenStreetMapImageryProvider,
  ImageryLayer,
  Cesium3DTileset,
} from 'cesium';
import type {
  LayerState,
  ShaderMode,
  MapTileMode,
  CameraState,
  AltitudeFilters,
  SatelliteFilters,
  TrackedEntityInfo,
  FlightData,
  SatelliteData,
  EarthquakeData,
  ShipData,
  CameraData,
  TrafficRoad,
} from '../../types';
import EntityClickHandler from './EntityClickHandler';
import FlightLayer from '../layers/FlightLayer';
import SatelliteLayer from '../layers/SatelliteLayer';
import EarthquakeLayer from '../layers/EarthquakeLayer';
import TrafficLayer from '../layers/TrafficLayer';
import ShipLayer from '../layers/ShipLayer';
import CCTVLayer from '../layers/CCTVLayer';
import { ShaderManager } from '../../shaders/postprocess';
import type { ShaderModeType } from '../../shaders/postprocess';

interface GlobeViewerProps {
  mapTiles: MapTileMode;
  shaderMode: ShaderMode;
  layers: LayerState;
  flights: FlightData[];
  satellites: SatelliteData[];
  earthquakes: EarthquakeData[];
  ships: ShipData[];
  cameras: CameraData[];
  trafficRoads: TrafficRoad[];
  altitudeFilters: AltitudeFilters;
  satelliteFilters: SatelliteFilters;
  showRoutePaths: boolean;
  trackedEntity: TrackedEntityInfo | null;
  selectedCamera: CameraData | null;
  onCameraChange: (state: CameraState) => void;
  onTrackEntity: (entity: TrackedEntityInfo | null) => void;
  onCctvClick: (camera: CameraData | null) => void;
  defaultCamera: CameraState;
}

// Check for Google API key at module level (VITE_ env vars are compile-time replaced)
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const CESIUM_ION_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN || '';

const GlobeViewer = forwardRef<CesiumViewer | null, GlobeViewerProps>(
  (props, ref) => {
    const viewerRef = useRef<CesiumViewer | null>(null);
    const google3dTilesetRef = useRef<Cesium3DTileset | null>(null);
    const osmLayerRef = useRef<ImageryLayer | null>(null);
    const shaderManagerRef = useRef<ShaderManager>(new ShaderManager());
    const [google3dAvailable, setGoogle3dAvailable] = useState(!!GOOGLE_API_KEY);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    useImperativeHandle(ref, () => viewerRef.current!, []);

    // Configure RequestScheduler for faster tile loading
    useEffect(() => {
      RequestScheduler.maximumRequests = 18;
      RequestScheduler.maximumRequestsPerServer = 12;
    }, []);

    // Set Cesium Ion token if available — used ONLY for Cesium Ion access
    useEffect(() => {
      if (CESIUM_ION_TOKEN) {
        Ion.defaultAccessToken = CESIUM_ION_TOKEN;
      }
    }, []);

    // Manage tile sources: Google 3D Tiles vs OSM fallback
    useEffect(() => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;

      const useGoogle = props.mapTiles === 'GOOGLE_3D' && google3dAvailable;

      // --- Google 3D Tiles ---
      if (useGoogle && !google3dTilesetRef.current) {
        // Load Google Photorealistic 3D Tiles
        createGooglePhotorealistic3DTileset({ key: GOOGLE_API_KEY })
          .then((tileset) => {
            if (viewer.isDestroyed()) return;
            google3dTilesetRef.current = tileset;
            viewer.scene.primitives.add(tileset);
            // Hide default globe to prevent reference system mismatch and black bleed-through
            viewer.scene.globe.show = false;
            // Remove any OSM imagery layer
            if (osmLayerRef.current) {
              viewer.imageryLayers.remove(osmLayerRef.current, true);
              osmLayerRef.current = null;
            }
          })
          .catch((err) => {
            // Google 3D Tiles failed — fall back to OSM
            console.warn('Google 3D Tiles failed to load, falling back to OSM:', err);
            setGoogle3dAvailable(false);
          });
      } else if (useGoogle && google3dTilesetRef.current) {
        // Google 3D tileset already loaded — ensure it's visible
        google3dTilesetRef.current.show = true;
        viewer.scene.globe.show = false;
        // Remove OSM layer if present
        if (osmLayerRef.current) {
          viewer.imageryLayers.remove(osmLayerRef.current, true);
          osmLayerRef.current = null;
        }
      }

      // --- OSM Tiles (fallback or explicit selection) ---
      if (!useGoogle) {
        // Hide Google 3D tileset if loaded
        if (google3dTilesetRef.current) {
          google3dTilesetRef.current.show = false;
        }
        // Show globe for OSM (depth buffer contribution)
        viewer.scene.globe.show = true;

        // Add OSM imagery layer if not already present
        if (!osmLayerRef.current) {
          // Remove all default imagery layers first
          viewer.imageryLayers.removeAll();
          const osmProvider = new OpenStreetMapImageryProvider({
            url: 'https://tile.openstreetmap.org/',
          });
          osmLayerRef.current = viewer.imageryLayers.addImageryProvider(osmProvider);
        }
      }

      // Cleanup on unmount
      return () => {
        // Don't destroy on re-renders, only track refs
      };
    }, [props.mapTiles, google3dAvailable]);

    // Manage post-processing shader modes (CRT, NVG, FLIR, STANDARD)
    useEffect(() => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;
      shaderManagerRef.current.applyMode(viewer, props.shaderMode as ShaderModeType);
      return () => {
        // Cleanup shader on unmount
        if (viewer && !viewer.isDestroyed()) {
          shaderManagerRef.current.destroy(viewer);
        }
      };
    }, [props.shaderMode]);

    // Sync camera state to App.tsx via camera.changed event (Feature #46)
    // Uses percentageChanged threshold of 0.01 to avoid excessive re-renders
    const onCameraChangeRef = useRef(props.onCameraChange);
    onCameraChangeRef.current = props.onCameraChange;

    useEffect(() => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;

      const camera = viewer.camera;
      // Set the percentage change threshold — camera.changed fires only when
      // position/direction changes by more than this fraction (0.01 = 1%)
      camera.percentageChanged = 0.01;

      const onChanged = () => {
        if (viewer.isDestroyed()) return;
        const cartographic = camera.positionCartographic;
        if (!cartographic) return;
        onCameraChangeRef.current({
          lat: CesiumMath.toDegrees(cartographic.latitude),
          lon: CesiumMath.toDegrees(cartographic.longitude),
          altitude: cartographic.height,
          heading: CesiumMath.toDegrees(camera.heading),
          pitch: CesiumMath.toDegrees(camera.pitch),
        });
      };

      camera.changed.addEventListener(onChanged);

      // Fire once immediately so App has initial camera state
      onChanged();

      return () => {
        if (!viewer.isDestroyed()) {
          camera.changed.removeEventListener(onChanged);
        }
      };
    }, []);

    return (
      <Viewer
        full
        ref={(e) => {
          if (e?.cesiumElement) {
            viewerRef.current = e.cesiumElement;
          }
        }}
        animation={false}
        timeline={false}
        baseLayerPicker={false}
        fullscreenButton={false}
        vrButton={false}
        geocoder={false}
        homeButton={false}
        infoBox={false}
        navigationHelpButton={false}
        sceneModePicker={false}
        selectionIndicator={false}
        contextOptions={{
          webgl: {
            alpha: false,
            depth: true,
            stencil: false,
            antialias: true,
          },
        }}
      >
        <Scene logarithmicDepthBuffer />
        <Globe
          baseColor={Color.BLACK}
          enableLighting={false}
          depthTestAgainstTerrain
          showGroundAtmosphere
        />
        <EntityClickHandler
          onTrackEntity={props.onTrackEntity}
          onCctvClick={props.onCctvClick}
        />
        {props.layers.flights && (
          <FlightLayer
            flights={props.flights}
            altitudeFilters={props.altitudeFilters}
            showRoutePaths={props.showRoutePaths}
            trackedEntity={props.trackedEntity}
          />
        )}
        {props.layers.satellites && (
          <SatelliteLayer
            satellites={props.satellites}
            filters={props.satelliteFilters}
          />
        )}
        {props.layers.earthquakes && (
          <EarthquakeLayer
            earthquakes={props.earthquakes}
            trackedEntity={props.trackedEntity}
          />
        )}
        {props.layers.traffic && (
          <TrafficLayer roads={props.trafficRoads} />
        )}
        {props.layers.ships && (
          <ShipLayer
            ships={props.ships}
            trackedEntity={props.trackedEntity}
          />
        )}
        {props.layers.cctv && (
          <CCTVLayer
            cameras={props.cameras}
            selectedCamera={props.selectedCamera}
          />
        )}
      </Viewer>
    );
  }
);

GlobeViewer.displayName = 'GlobeViewer';
export default GlobeViewer;
