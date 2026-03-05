import { useEffect, useRef, useCallback } from 'react';
import { useCesium } from 'resium';
import {
  Cartesian3,
  Color,
  Entity,
  ConstantProperty,
  ConstantPositionProperty,
  Math as CesiumMath,
  NearFarScalar,
  VerticalOrigin,
  HorizontalOrigin,
  LabelStyle,
  Cartesian2,
  PolylineDashMaterialProperty,
} from 'cesium';
import * as satellite from 'satellite.js';
import type { SatelliteData, SatelliteFilters } from '../../types';

interface SatelliteLayerProps {
  satellites: SatelliteData[];
  filters: SatelliteFilters;
}

// ---------- Constants ----------
const ISS_NORAD = 25544;
const ISS_COLOR = Color.fromCssColorString('#00D4FF');
const OTHER_COLOR = Color.fromCssColorString('#39FF14');
const POSITION_UPDATE_MS = 200; // 5Hz
const ORBIT_UPDATE_MS = 30000; // 30s
// Earth radius used for occlusion calculations (meters)
// const EARTH_RADIUS = 6371000;

// ---------- Canvas satellite icon ----------
// 32x32: diamond body + dual solar panels with grid detail + directional arrow tip
function drawSatelliteIcon(color: string, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 32;

  ctx.save();
  ctx.translate(cx, cy);

  // Solar panels (rectangles on either side)
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.7;
  ctx.fillRect(-14 * scale, -4 * scale, 8 * scale, 8 * scale);
  ctx.fillRect(6 * scale, -4 * scale, 8 * scale, 8 * scale);

  // Panel grid lines
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5 * scale;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo((-14 + i * 2) * scale, -4 * scale);
    ctx.lineTo((-14 + i * 2) * scale, 4 * scale);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-14 * scale, 0);
  ctx.lineTo(-6 * scale, 0);
  ctx.stroke();
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo((6 + i * 2) * scale, -4 * scale);
    ctx.lineTo((6 + i * 2) * scale, 4 * scale);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(6 * scale, 0);
  ctx.lineTo(14 * scale, 0);
  ctx.stroke();

  // Diamond body
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -5 * scale);
  ctx.lineTo(5 * scale, 0);
  ctx.lineTo(0, 5 * scale);
  ctx.lineTo(-5 * scale, 0);
  ctx.closePath();
  ctx.fill();

  // Directional arrow tip
  ctx.beginPath();
  ctx.moveTo(0, -8 * scale);
  ctx.lineTo(-2 * scale, -5 * scale);
  ctx.lineTo(2 * scale, -5 * scale);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
  return canvas;
}

// Pre-render icon canvases
let issIconDataUrl: string | null = null;
let otherIconDataUrl: string | null = null;

function getIssIcon(): string {
  if (!issIconDataUrl) {
    issIconDataUrl = drawSatelliteIcon('#00D4FF', 32).toDataURL();
  }
  return issIconDataUrl;
}

function getOtherIcon(): string {
  if (!otherIconDataUrl) {
    otherIconDataUrl = drawSatelliteIcon('#39FF14', 32).toDataURL();
  }
  return otherIconDataUrl;
}

// ---------- SGP4 Propagation Helper ----------
function propagateSat(
  satrec: satellite.SatRec,
  date: Date
): { lon: number; lat: number; altKm: number } | null {
  const positionAndVelocity = satellite.propagate(satrec, date);
  const posEci = positionAndVelocity.position;
  if (!posEci || typeof posEci === 'boolean') return null;

  const gmst = satellite.gstime(date);
  const geo = satellite.eciToGeodetic(posEci as satellite.EciVec3<number>, gmst);

  const lon = CesiumMath.toDegrees(geo.longitude);
  const lat = CesiumMath.toDegrees(geo.latitude);
  const altKm = geo.height;

  if (isNaN(lon) || isNaN(lat) || isNaN(altKm)) return null;
  if (altKm < 100 || altKm > 100000) return null;

  return { lon, lat, altKm };
}

function computeBearing(
  satrec: satellite.SatRec,
  now: Date
): number {
  const future = new Date(now.getTime() + 10000);
  const posCur = propagateSat(satrec, now);
  const posFut = propagateSat(satrec, future);
  if (!posCur || !posFut) return 0;

  const dLon = (posFut.lon - posCur.lon) * Math.PI / 180;
  const lat1 = posCur.lat * Math.PI / 180;
  const lat2 = posFut.lat * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return Math.atan2(y, x);
}

// Far-side occlusion check: is the satellite visible from the camera?
// Uses dot product to check if point is on the visible hemisphere
function isVisibleFromCamera(satCartesian: Cartesian3, cameraPosition: Cartesian3): boolean {
  // Vector from Earth center to satellite
  const toSat = Cartesian3.normalize(satCartesian, new Cartesian3());
  // Vector from Earth center to camera
  const toCam = Cartesian3.normalize(cameraPosition, new Cartesian3());
  // If dot product > 0, both are on the same hemisphere
  const dot = Cartesian3.dot(toSat, toCam);
  // Use a threshold slightly below 0 to include satellites near the horizon
  return dot > -0.1;
}

/**
 * SatelliteLayer - Client-side orbital propagation using satellite.js
 * Parses TLE data, computes positions via SGP4/SDP4, renders as Cesium Entity components.
 * Two propagation cycles: orbit paths (30s), current positions (5Hz / 200ms).
 * Canvas-drawn icons with rotation by bearing.
 * Far-side satellites hidden via dot-product occlusion check.
 */
export default function SatelliteLayer({ satellites, filters }: SatelliteLayerProps) {
  const { viewer } = useCesium();
  const entitiesRef = useRef<Map<number, Entity>>(new Map());
  const satrecsRef = useRef<Map<number, satellite.SatRec>>(new Map());
  const positionsRef = useRef<Map<number, { lon: number; lat: number; altKm: number; bearing: number }>>(new Map());
  const propagationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const orbitIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const orbitEntitiesRef = useRef<Entity[]>([]);

  // Parse TLEs into satrec objects
  const parseTLEs = useCallback(() => {
    const satrecMap = new Map<number, satellite.SatRec>();
    for (const sat of satellites) {
      try {
        const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
        if (satrec) {
          satrecMap.set(sat.noradId, satrec);
        }
      } catch {
        // Skip invalid TLEs
      }
    }
    satrecsRef.current = satrecMap;
    return satrecMap;
  }, [satellites]);

  // Propagate all satellites to current time
  const propagateAll = useCallback(() => {
    const now = new Date();
    const positions = new Map<number, { lon: number; lat: number; altKm: number; bearing: number }>();

    for (const sat of satellites) {
      const satrec = satrecsRef.current.get(sat.noradId);
      if (!satrec) continue;

      const pos = propagateSat(satrec, now);
      if (!pos) continue;

      const bearing = computeBearing(satrec, now);
      positions.set(sat.noradId, { ...pos, bearing });
    }

    positionsRef.current = positions;
    return positions;
  }, [satellites]);

  // Compute orbit paths (90 future positions at 1-minute intervals)
  const computeOrbitPaths = useCallback(() => {
    if (!viewer || viewer.isDestroyed()) return;
    if (!filters.showPaths) return;

    // Remove old orbit entities
    for (const entity of orbitEntitiesRef.current) {
      viewer.entities.remove(entity);
    }
    orbitEntitiesRef.current = [];

    const now = new Date();

    for (const sat of satellites) {
      const isISS = sat.noradId === ISS_NORAD;
      if (isISS && !filters.iss) continue;
      if (!isISS && !filters.other) continue;

      const satrec = satrecsRef.current.get(sat.noradId);
      if (!satrec) continue;

      const orbitPositions: Cartesian3[] = [];
      const groundPositions: Cartesian3[] = [];

      for (let i = 0; i < 90; i++) {
        const t = new Date(now.getTime() + i * 60000);
        const pos = propagateSat(satrec, t);
        if (!pos) continue;
        orbitPositions.push(Cartesian3.fromDegrees(pos.lon, pos.lat, pos.altKm * 1000));
        groundPositions.push(Cartesian3.fromDegrees(pos.lon, pos.lat, 0));
      }

      if (orbitPositions.length < 2) continue;

      const satColor = isISS ? ISS_COLOR : OTHER_COLOR;
      const pathWidth = isISS ? 3 : 2;

      // Orbit path (solid polyline at satellite altitude)
      const orbitEntity = viewer.entities.add({
        polyline: {
          positions: orbitPositions,
          width: pathWidth,
          material: satColor.withAlpha(0.6),
          clampToGround: false,
        },
        id: `sat_orbit_${sat.noradId}`,
      } as Entity.ConstructorOptions);
      orbitEntitiesRef.current.push(orbitEntity);

      // Ground track (dashed polyline on surface)
      const groundEntity = viewer.entities.add({
        polyline: {
          positions: groundPositions,
          width: 1,
          material: new PolylineDashMaterialProperty({
            color: satColor.withAlpha(0.3),
            dashLength: 8,
          }),
          clampToGround: true,
        },
        id: `sat_ground_${sat.noradId}`,
      } as Entity.ConstructorOptions);
      orbitEntitiesRef.current.push(groundEntity);

      // Nadir line (semi-transparent vertical from satellite to ground)
      const curPos = positionsRef.current.get(sat.noradId);
      if (curPos) {
        const nadirEntity = viewer.entities.add({
          polyline: {
            positions: [
              Cartesian3.fromDegrees(curPos.lon, curPos.lat, curPos.altKm * 1000),
              Cartesian3.fromDegrees(curPos.lon, curPos.lat, 0),
            ],
            width: 1,
            material: satColor.withAlpha(0.15),
          },
          id: `sat_nadir_${sat.noradId}`,
        } as Entity.ConstructorOptions);
        orbitEntitiesRef.current.push(nadirEntity);
      }
    }
  }, [viewer, satellites, filters]);

  // Main setup effect
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    if (satellites.length === 0) return;

    // Parse TLEs
    parseTLEs();

    // Initial propagation
    const positions = propagateAll();

    // Create entities for each satellite
    const entityMap = new Map<number, Entity>();

    for (const sat of satellites) {
      const pos = positions.get(sat.noradId);
      if (!pos) continue;

      const isISS = sat.noradId === ISS_NORAD;

      // Apply filters
      if (isISS && !filters.iss) continue;
      if (!isISS && !filters.other) continue;

      const satColor = isISS ? ISS_COLOR : OTHER_COLOR;
      const iconUrl = isISS ? getIssIcon() : getOtherIcon();
      const scale = isISS ? 0.6 : 0.35;

      const position = Cartesian3.fromDegrees(pos.lon, pos.lat, pos.altKm * 1000);

      const entity = viewer.entities.add({
        position: position,
        billboard: {
          image: iconUrl,
          scale,
          rotation: -pos.bearing,
          alignedAxis: Cartesian3.UNIT_Z,
          verticalOrigin: VerticalOrigin.CENTER,
          horizontalOrigin: HorizontalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          translucencyByDistance: new NearFarScalar(1e6, 1.0, 5e7, 0.3),
        },
        label: {
          text: isISS ? sat.name : '',
          font: '10px monospace',
          fillColor: satColor,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.TOP,
          horizontalOrigin: HorizontalOrigin.LEFT,
          pixelOffset: new Cartesian2(10, 5),
          scale: 1.0,
          showBackground: isISS,
          backgroundColor: Color.BLACK.withAlpha(0.5),
          translucencyByDistance: new NearFarScalar(1e6, 1.0, 2e7, 0.0),
        },
        id: `satellite_${sat.noradId}`,
        properties: {
          type: 'satellite',
          norad: sat.noradId,
          name: sat.name,
          category: sat.category,
          altitude: pos.altKm,
          tle: `${sat.tle1}\n${sat.tle2}`,
        },
      } as Entity.ConstructorOptions);

      entityMap.set(sat.noradId, entity);
    }

    entitiesRef.current = entityMap;

    // Start 5Hz position propagation
    propagationIntervalRef.current = setInterval(() => {
      if (!viewer || viewer.isDestroyed()) return;

      const newPositions = propagateAll();
      const cameraPos = viewer.camera.positionWC;

      for (const [noradId, entity] of entityMap) {
        const pos = newPositions.get(noradId);
        if (!pos) {
          entity.show = false;
          continue;
        }

        const cartesian = Cartesian3.fromDegrees(pos.lon, pos.lat, pos.altKm * 1000);

        // Far-side occlusion check
        const visible = isVisibleFromCamera(cartesian, cameraPos);
        entity.show = visible;

        if (!visible) continue;

        // Update position
        (entity as any).position = new ConstantPositionProperty(cartesian);

        // Update billboard rotation
        if (entity.billboard) {
          (entity.billboard.rotation as any) = new ConstantProperty(-pos.bearing);
        }
      }
    }, POSITION_UPDATE_MS);

    // Start 30s orbit path computation
    if (filters.showPaths) {
      computeOrbitPaths();
      orbitIntervalRef.current = setInterval(computeOrbitPaths, ORBIT_UPDATE_MS);
    }

    // Cleanup
    return () => {
      if (propagationIntervalRef.current) {
        clearInterval(propagationIntervalRef.current);
        propagationIntervalRef.current = null;
      }
      if (orbitIntervalRef.current) {
        clearInterval(orbitIntervalRef.current);
        orbitIntervalRef.current = null;
      }

      // Remove orbit entities
      for (const entity of orbitEntitiesRef.current) {
        if (viewer && !viewer.isDestroyed()) {
          viewer.entities.remove(entity);
        }
      }
      orbitEntitiesRef.current = [];

      // Remove satellite entities
      for (const [, entity] of entityMap) {
        if (viewer && !viewer.isDestroyed()) {
          viewer.entities.remove(entity);
        }
      }
      entitiesRef.current = new Map();
      positionsRef.current = new Map();
    };
  }, [viewer, satellites, filters, parseTLEs, propagateAll, computeOrbitPaths]);

  return null;
}
