import { useEffect, useRef } from 'react';
import { useCesium } from 'resium';
import {
  Cartesian3,
  Color,
  PolylineCollection,
  PointPrimitiveCollection,
  PointPrimitive,
  Material,
} from 'cesium';
import type { TrafficRoad } from '../../types';

interface TrafficLayerProps {
  roads: TrafficRoad[];
  onVehicleCount?: (count: number) => void;
}

// --- Road classification visual config ---
interface RoadConfig {
  width: number;
  color: Color;
  vehiclesPerKm: number;
  speedKmh: number;
}

const ROAD_CONFIG: Record<string, RoadConfig> = {
  motorway:    { width: 3,   color: Color.fromCssColorString('#FF6B6B'), vehiclesPerKm: 2,   speedKmh: 110 },
  trunk:       { width: 2.5, color: Color.fromCssColorString('#FFA500'), vehiclesPerKm: 1.5, speedKmh: 90 },
  primary:     { width: 2,   color: Color.fromCssColorString('#FFD700'), vehiclesPerKm: 1,   speedKmh: 60 },
  secondary:   { width: 1.5, color: Color.fromCssColorString('#00FF00'), vehiclesPerKm: 0.5, speedKmh: 50 },
  tertiary:    { width: 1,   color: Color.fromCssColorString('#00CED1'), vehiclesPerKm: 0.3, speedKmh: 40 },
  residential: { width: 0.8, color: Color.fromCssColorString('#00BFFF'), vehiclesPerKm: 0.2, speedKmh: 30 },
};

const DEFAULT_CONFIG: RoadConfig = { width: 1, color: Color.GRAY, vehiclesPerKm: 0.2, speedKmh: 30 };

// 5Hz state sync interval (200ms) to reduce React render overhead
const STATE_SYNC_INTERVAL = 200;

// --- Haversine distance between two [lon, lat] points in meters ---
function haversineDistance(p1: [number, number], p2: [number, number]): number {
  const R = 6371000;
  const toRad = (deg: number) => deg * Math.PI / 180;
  const dLat = toRad(p2[1] - p1[1]);
  const dLon = toRad(p2[0] - p1[0]);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p1[1])) * Math.cos(toRad(p2[1])) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Compute bearing between two [lon, lat] points in radians ---
function computeBearing(p1: [number, number], p2: [number, number]): number {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const lat1 = toRad(p1[1]);
  const lat2 = toRad(p2[1]);
  const dLon = toRad(p2[0] - p1[0]);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return Math.atan2(y, x); // radians, 0 = north, clockwise positive
}

// --- Compute cumulative distances along road geometry ---
function computeCumulativeDistances(geometry: [number, number][]): number[] {
  const distances: number[] = [0];
  for (let i = 1; i < geometry.length; i++) {
    const prev = geometry[i - 1]!;
    const curr = geometry[i]!;
    distances.push(distances[distances.length - 1]! + haversineDistance(prev, curr));
  }
  return distances;
}

// --- Precompute segment bearings for entire road geometry ---
function computeSegmentBearings(geometry: [number, number][]): number[] {
  const bearings: number[] = [];
  for (let i = 0; i < geometry.length - 1; i++) {
    bearings.push(computeBearing(geometry[i]!, geometry[i + 1]!));
  }
  // Last segment has same bearing as the one before it
  if (bearings.length > 0) {
    bearings.push(bearings[bearings.length - 1]!);
  } else {
    bearings.push(0);
  }
  return bearings;
}

// --- Interpolate position AND heading along road at a given distance ---
function interpolateAlongRoad(
  geometry: [number, number][],
  cumDistances: number[],
  segmentBearings: number[],
  distance: number
): { lon: number; lat: number; heading: number } {
  const totalLength = cumDistances[cumDistances.length - 1] ?? 0;
  if (totalLength <= 0) {
    const p = geometry[0] ?? [0, 0];
    return { lon: p[0], lat: p[1], heading: segmentBearings[0] ?? 0 };
  }

  // Wrap distance within road length
  const d = ((distance % totalLength) + totalLength) % totalLength;

  // Find segment
  for (let i = 1; i < cumDistances.length; i++) {
    const cumDist = cumDistances[i] ?? 0;
    const prevCumDist = cumDistances[i - 1] ?? 0;
    if (d <= cumDist) {
      const segLen = cumDist - prevCumDist;
      if (segLen <= 0) {
        const p = geometry[i - 1] ?? [0, 0];
        return { lon: p[0], lat: p[1], heading: segmentBearings[i - 1] ?? 0 };
      }
      const t = (d - prevCumDist) / segLen;
      const p1 = geometry[i - 1]!;
      const p2 = geometry[i]!;
      return {
        lon: p1[0] + t * (p2[0] - p1[0]),
        lat: p1[1] + t * (p2[1] - p1[1]),
        heading: segmentBearings[i - 1] ?? 0,
      };
    }
  }

  const lastP = geometry[geometry.length - 1] ?? [0, 0];
  return { lon: lastP[0], lat: lastP[1], heading: segmentBearings[segmentBearings.length - 1] ?? 0 };
}

// --- Vehicle state ---
interface Vehicle {
  roadIdx: number;
  position: number;  // distance along road in meters
  velocity: number;  // m/s
  heading: number;   // bearing in radians (computed from road geometry)
  point: PointPrimitive;
}

// --- Precomputed road data ---
interface RoadData {
  road: TrafficRoad;
  config: RoadConfig;
  cumDistances: number[];
  segmentBearings: number[];
  totalLength: number;
}

/**
 * TrafficLayer - Animated street-level vehicle simulation
 * PolylineCollection for roads, PointPrimitiveCollection for vehicle particles.
 * 60fps animation via requestAnimationFrame with Haversine interpolation.
 * Vehicle heading calculated from bearing between consecutive road geometry points.
 * React state (vehicle count) syncs at 5Hz (200ms) to reduce render overhead.
 */
export default function TrafficLayer({ roads, onVehicleCount }: TrafficLayerProps) {
  const { viewer } = useCesium();
  const roadCollectionRef = useRef<PolylineCollection | null>(null);
  const vehicleCollectionRef = useRef<PointPrimitiveCollection | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const vehiclesRef = useRef<Vehicle[]>([]);
  const roadDataRef = useRef<RoadData[]>([]);
  const lastTimeRef = useRef<number>(0);
  const lastStateSyncRef = useRef<number>(0);
  const initRef = useRef(false);
  const onVehicleCountRef = useRef(onVehicleCount);

  // Keep callback ref in sync without triggering re-renders
  useEffect(() => {
    onVehicleCountRef.current = onVehicleCount;
  }, [onVehicleCount]);

  // Initialize primitive collections
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || initRef.current) return;

    const roadCollection = new PolylineCollection();
    const vehicleCollection = new PointPrimitiveCollection();

    viewer.scene.primitives.add(roadCollection);
    viewer.scene.primitives.add(vehicleCollection);

    roadCollectionRef.current = roadCollection;
    vehicleCollectionRef.current = vehicleCollection;
    initRef.current = true;

    return () => {
      if (viewer && !viewer.isDestroyed()) {
        if (roadCollectionRef.current) {
          viewer.scene.primitives.remove(roadCollectionRef.current);
          roadCollectionRef.current = null;
        }
        if (vehicleCollectionRef.current) {
          viewer.scene.primitives.remove(vehicleCollectionRef.current);
          vehicleCollectionRef.current = null;
        }
      }
      initRef.current = false;
    };
  }, [viewer]);

  // Build roads and vehicles when road data changes
  useEffect(() => {
    const roadCollection = roadCollectionRef.current;
    const vehicleCollection = vehicleCollectionRef.current;
    if (!roadCollection || !vehicleCollection || !viewer || viewer.isDestroyed()) return;

    // Clear existing
    roadCollection.removeAll();
    vehicleCollection.removeAll();
    vehiclesRef.current = [];
    roadDataRef.current = [];

    if (roads.length === 0) {
      if (onVehicleCountRef.current) onVehicleCountRef.current(0);
      return;
    }

    // Precompute road data
    const newRoadData: RoadData[] = [];
    for (const road of roads) {
      if (road.geometry.length < 2) continue;

      const config = ROAD_CONFIG[road.classification] || DEFAULT_CONFIG;
      const cumDistances = computeCumulativeDistances(road.geometry);
      const segmentBearings = computeSegmentBearings(road.geometry);
      const totalLength = cumDistances[cumDistances.length - 1] ?? 0;

      // Skip very short roads (< 10m)
      if (totalLength < 10) continue;

      newRoadData.push({ road, config, cumDistances, segmentBearings, totalLength });

      // Add road polyline
      const positions = road.geometry.map(([lon, lat]) =>
        Cartesian3.fromDegrees(lon, lat, 2) // slight elevation above ground
      );

      roadCollection.add({
        positions,
        width: config.width,
        material: Material.fromType('Color', {
          color: config.color.withAlpha(0.7),
        }),
      });
    }

    roadDataRef.current = newRoadData;

    // Generate vehicles for each road
    const newVehicles: Vehicle[] = [];
    for (let ri = 0; ri < newRoadData.length; ri++) {
      const rd = newRoadData[ri]!;
      const roadLengthKm = rd.totalLength / 1000;
      const numVehicles = Math.max(1, Math.round(roadLengthKm * rd.config.vehiclesPerKm));

      // Cap at 5 vehicles per road segment to manage performance
      const cappedVehicles = Math.min(numVehicles, 5);

      for (let v = 0; v < cappedVehicles; v++) {
        const startPos = (rd.totalLength / cappedVehicles) * v + Math.random() * (rd.totalLength / cappedVehicles);
        const velocity = (rd.config.speedKmh * 1000) / 3600; // km/h to m/s

        // Interpolate initial position and heading
        const { lon, lat, heading } = interpolateAlongRoad(
          rd.road.geometry,
          rd.cumDistances,
          rd.segmentBearings,
          startPos
        );

        const point = vehicleCollection.add({
          position: Cartesian3.fromDegrees(lon, lat, 5),
          pixelSize: 4,
          color: Color.WHITE.withAlpha(0.9),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });

        newVehicles.push({
          roadIdx: ri,
          position: startPos,
          velocity,
          heading,
          point,
        });
      }
    }

    vehiclesRef.current = newVehicles;
    lastTimeRef.current = performance.now();
    lastStateSyncRef.current = performance.now();

    // Report initial vehicle count via 5Hz sync
    if (onVehicleCountRef.current) {
      onVehicleCountRef.current(newVehicles.length);
    }

  }, [viewer, roads]);

  // Animation loop - 60fps vehicle movement with bearing computation
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Cancel existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    lastTimeRef.current = performance.now();
    lastStateSyncRef.current = performance.now();

    const animate = (currentTime: number) => {
      if (!viewer || viewer.isDestroyed()) return;

      const deltaTime = (currentTime - lastTimeRef.current) / 1000; // seconds
      lastTimeRef.current = currentTime;

      // Clamp deltaTime to prevent jumps (tab switch, etc.)
      const dt = Math.min(deltaTime, 0.1);

      const vehicles = vehiclesRef.current;
      const roadData = roadDataRef.current;

      for (let i = 0; i < vehicles.length; i++) {
        const vehicle = vehicles[i];
        if (!vehicle || !vehicle.point) continue;

        const rd = roadData[vehicle.roadIdx];
        if (!rd) continue;

        // Update position along road
        vehicle.position += vehicle.velocity * dt;

        // Wrap around road length for continuous circulation
        if (rd.totalLength > 0) {
          vehicle.position = vehicle.position % rd.totalLength;
        }

        // Interpolate new geographic position and heading from road geometry
        const { lon, lat, heading } = interpolateAlongRoad(
          rd.road.geometry,
          rd.cumDistances,
          rd.segmentBearings,
          vehicle.position
        );

        // Store computed heading for external use (e.g., TrackedEntityPanel)
        vehicle.heading = heading;

        // Update point position
        vehicle.point.position = Cartesian3.fromDegrees(lon, lat, 5);
      }

      // 5Hz (200ms) React state sync for vehicle count — avoids per-frame React renders
      if (currentTime - lastStateSyncRef.current >= STATE_SYNC_INTERVAL) {
        lastStateSyncRef.current = currentTime;
        if (onVehicleCountRef.current) {
          onVehicleCountRef.current(vehicles.length);
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [viewer, roads]);

  return null;
}
