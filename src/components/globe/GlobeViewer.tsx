import { forwardRef, useEffect, useRef, useImperativeHandle } from 'react';
import { Viewer, Globe, Scene } from 'resium';
import { Viewer as CesiumViewer, Ion, Color, RequestScheduler } from 'cesium';
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

const GlobeViewer = forwardRef<CesiumViewer | null, GlobeViewerProps>(
  (props, ref) => {
    const viewerRef = useRef<CesiumViewer | null>(null);

    useImperativeHandle(ref, () => viewerRef.current);

    // Configure RequestScheduler for faster tile loading
    useEffect(() => {
      RequestScheduler.maximumRequests = 18;
      RequestScheduler.maximumRequestsPerServer = 12;
    }, []);

    // Set Cesium Ion token if available
    useEffect(() => {
      const token = import.meta.env.VITE_CESIUM_ION_TOKEN;
      if (token) {
        Ion.defaultAccessToken = token;
      }
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
          <EarthquakeLayer earthquakes={props.earthquakes} />
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
