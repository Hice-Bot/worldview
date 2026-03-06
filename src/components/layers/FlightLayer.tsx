import { useEffect, useRef, useCallback } from 'react';
import { useCesium } from 'resium';
import {
  Cartesian2,
  Cartesian3,
  Color,
  BillboardCollection,
  LabelCollection,
  PolylineCollection,
  LabelStyle,
  VerticalOrigin,
  HorizontalOrigin,
  Math as CesiumMath,
  Cartographic,
  EllipsoidGeodesic,
  Ellipsoid,
  Material,
  Billboard,
  Label,
  Polyline,
} from 'cesium';
import type { FlightData, AltitudeFilters, TrackedEntityInfo } from '../../types';
import { trackingManager } from '../../trackingManager';
import { findAirport } from '../../data/airports';

interface FlightLayerProps {
  flights: FlightData[];
  altitudeFilters: AltitudeFilters;
  showRoutePaths: boolean;
  trackedEntity: TrackedEntityInfo | null;
}

// --- Constants ---
const EARTH_RADIUS = 6371000; // meters
const DR_BULK_INTERVAL = 1000; // Dead reckoning bulk update: 1s for non-tracked
const OCCLUSION_INTERVAL = 1000; // Occlusion check: 1Hz

// --- Altitude band classification with colors ---
const COLOR_CYAN = Color.CYAN;
const COLOR_LIGHT_BLUE = Color.fromCssColorString('#87CEEB');
const COLOR_GOLD = Color.fromCssColorString('#FFD700');
const COLOR_ORANGE = Color.ORANGE;
const COLOR_RED = Color.RED;

function getAltitudeColor(altFeet: number): Color {
  if (altFeet >= 35000) return COLOR_CYAN;
  if (altFeet >= 20000) return COLOR_LIGHT_BLUE;
  if (altFeet >= 10000) return COLOR_GOLD;
  if (altFeet >= 3000) return COLOR_ORANGE;
  return COLOR_RED;
}

function getAltitudeBand(altFeet: number): keyof AltitudeFilters {
  if (altFeet >= 35000) return 'cruise';
  if (altFeet >= 20000) return 'high';
  if (altFeet >= 10000) return 'mid';
  if (altFeet >= 3000) return 'low';
  return 'ground';
}

function getAltitudeScale(altFeet: number): number {
  if (altFeet >= 35000) return 0.35;
  if (altFeet >= 20000) return 0.4;
  if (altFeet >= 10000) return 0.5;
  if (altFeet >= 3000) return 0.6;
  return 0.7;
}

// --- Canvas-drawn aircraft icon (top-down airplane silhouette) ---
let cachedIconDataUrl: string | null = null;
function getAircraftIconUrl(): string {
  if (cachedIconDataUrl) return cachedIconDataUrl;
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 0.5;

  ctx.beginPath();
  ctx.moveTo(16, 2);
  ctx.lineTo(18, 8);
  ctx.lineTo(18, 12);
  ctx.lineTo(30, 16);
  ctx.lineTo(30, 18);
  ctx.lineTo(18, 16);
  ctx.lineTo(18, 24);
  ctx.lineTo(24, 28);
  ctx.lineTo(24, 30);
  ctx.lineTo(18, 27);
  ctx.lineTo(16, 30);
  ctx.lineTo(14, 27);
  ctx.lineTo(8, 30);
  ctx.lineTo(8, 28);
  ctx.lineTo(14, 24);
  ctx.lineTo(14, 16);
  ctx.lineTo(2, 18);
  ctx.lineTo(2, 16);
  ctx.lineTo(14, 12);
  ctx.lineTo(14, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  cachedIconDataUrl = canvas.toDataURL('image/png');
  return cachedIconDataUrl;
}

// --- Compute great-circle route arc positions via EllipsoidGeodesic ---
function computeRouteArc(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
  cruiseAltMeters: number
): Cartesian3[] {
  const NUM_SEGMENTS = 12;
  const geodesic = new EllipsoidGeodesic(
    Cartographic.fromDegrees(originLon, originLat),
    Cartographic.fromDegrees(destLon, destLat),
    Ellipsoid.WGS84
  );

  const positions: Cartesian3[] = [];
  for (let i = 0; i <= NUM_SEGMENTS; i++) {
    const fraction = i / NUM_SEGMENTS;
    const point = geodesic.interpolateUsingFraction(fraction);
    const altFactor = 4 * fraction * (1 - fraction);
    const alt = cruiseAltMeters * altFactor;
    positions.push(Cartesian3.fromRadians(point.longitude, point.latitude, alt));
  }
  return positions;
}

// --- Compute heading trail positions ---
function computeHeadingTrail(
  lon: number,
  lat: number,
  altMeters: number,
  headingDeg: number,
  velocityMs: number
): Cartesian3[] {
  const trailDurationSec = 30;
  const distanceMeters = velocityMs * trailDurationSec;
  if (distanceMeters < 100) return [];

  const headingRad = CesiumMath.toRadians(headingDeg);
  const reverseHeadingRad = headingRad + Math.PI;
  const latRad = CesiumMath.toRadians(lat);
  const lonRad = CesiumMath.toRadians(lon);

  const positions: Cartesian3[] = [];
  positions.push(Cartesian3.fromDegrees(lon, lat, altMeters));

  for (let i = 1; i <= 3; i++) {
    const d = (distanceMeters * i) / 3;
    const dOverR = d / EARTH_RADIUS;
    const trailLat = Math.asin(
      Math.sin(latRad) * Math.cos(dOverR) +
      Math.cos(latRad) * Math.sin(dOverR) * Math.cos(reverseHeadingRad)
    );
    const trailLon = lonRad + Math.atan2(
      Math.sin(reverseHeadingRad) * Math.sin(dOverR) * Math.cos(latRad),
      Math.cos(dOverR) - Math.sin(latRad) * Math.sin(trailLat)
    );
    positions.push(Cartesian3.fromDegrees(
      CesiumMath.toDegrees(trailLon),
      CesiumMath.toDegrees(trailLat),
      altMeters
    ));
  }

  return positions;
}

// --- Dead reckoning: extrapolate position using heading + velocity ---
// Uses great-circle forward projection from a base position
function deadReckonPosition(
  baseLat: number,
  baseLon: number,
  baseAlt: number,
  headingDeg: number,
  velocityMs: number,
  verticalRate: number,
  dtSeconds: number
): { lat: number; lon: number; alt: number } {
  if (velocityMs < 1 || dtSeconds <= 0) {
    return { lat: baseLat, lon: baseLon, alt: baseAlt };
  }

  // Clamp dt to avoid runaway extrapolation (max 30s)
  const dt = Math.min(dtSeconds, 30);
  const distanceMeters = velocityMs * dt;
  const dOverR = distanceMeters / EARTH_RADIUS;

  const headingRad = CesiumMath.toRadians(headingDeg);
  const latRad = CesiumMath.toRadians(baseLat);
  const lonRad = CesiumMath.toRadians(baseLon);

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(dOverR) +
    Math.cos(latRad) * Math.sin(dOverR) * Math.cos(headingRad)
  );
  const newLonRad = lonRad + Math.atan2(
    Math.sin(headingRad) * Math.sin(dOverR) * Math.cos(latRad),
    Math.cos(dOverR) - Math.sin(latRad) * Math.sin(newLatRad)
  );

  // Vertical rate extrapolation (ft/min to m/s: * 0.00508)
  const verticalMs = verticalRate * 0.00508;
  const altChange = verticalMs * dt;
  const newAlt = Math.max(0, baseAlt + altChange);

  return {
    lat: CesiumMath.toDegrees(newLatRad),
    lon: CesiumMath.toDegrees(newLonRad),
    alt: newAlt,
  };
}

// --- Per-aircraft tracking entry with dead reckoning state ---
interface FlightEntry {
  billboard: Billboard;
  label: Label;
  flight: FlightData;
  position: Cartesian3;
  headingTrail: Polyline | null;
  routeArc: Polyline | null;
  // Dead reckoning state
  baseLat: number;
  baseLon: number;
  baseAlt: number;
  heading: number;
  velocityMs: number;
  verticalRate: number;
  lastDataTime: number;   // timestamp when data was received from API
  drLat: number;          // current dead-reckoned latitude
  drLon: number;          // current dead-reckoned longitude
  drAlt: number;          // current dead-reckoned altitude
}

/**
 * FlightLayer - Renders aircraft using imperative Cesium BillboardCollection + LabelCollection.
 * PolylineCollection x2: one for heading trails, one for great-circle route arcs.
 * Dead reckoning interpolation: tracked aircraft update every frame, others every 1s.
 * Altitude band coloring: Cruise=cyan, High=light blue, Mid=gold, Low=orange, Ground=red.
 * Far-side occlusion via dot-product hemisphere check.
 */
export default function FlightLayer({ flights, altitudeFilters, showRoutePaths, trackedEntity }: FlightLayerProps) {
  const { viewer } = useCesium();
  const billboardCollectionRef = useRef<BillboardCollection | null>(null);
  const labelCollectionRef = useRef<LabelCollection | null>(null);
  const trailCollectionRef = useRef<PolylineCollection | null>(null);
  const routeCollectionRef = useRef<PolylineCollection | null>(null);
  const flightMapRef = useRef<Map<string, FlightEntry>>(new Map());
  const initRef = useRef(false);
  const preRenderRef = useRef<(() => void) | null>(null);
  const trackedEntityRef = useRef<TrackedEntityInfo | null>(null);

  // Keep tracked entity ref in sync
  useEffect(() => {
    trackedEntityRef.current = trackedEntity;
  }, [trackedEntity]);

  // Create collections once when viewer is available
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || initRef.current) return;

    const bbCollection = new BillboardCollection({ scene: viewer.scene });
    const lblCollection = new LabelCollection({ scene: viewer.scene });
    const trailCollection = new PolylineCollection();
    const routeCollection = new PolylineCollection();

    viewer.scene.primitives.add(bbCollection);
    viewer.scene.primitives.add(lblCollection);
    viewer.scene.primitives.add(trailCollection);
    viewer.scene.primitives.add(routeCollection);

    billboardCollectionRef.current = bbCollection;
    labelCollectionRef.current = lblCollection;
    trailCollectionRef.current = trailCollection;
    routeCollectionRef.current = routeCollection;
    initRef.current = true;

    return () => {
      if (viewer && !viewer.isDestroyed()) {
        if (billboardCollectionRef.current) {
          viewer.scene.primitives.remove(billboardCollectionRef.current);
        }
        if (labelCollectionRef.current) {
          viewer.scene.primitives.remove(labelCollectionRef.current);
        }
        if (trailCollectionRef.current) {
          viewer.scene.primitives.remove(trailCollectionRef.current);
        }
        if (routeCollectionRef.current) {
          viewer.scene.primitives.remove(routeCollectionRef.current);
        }
      }
      billboardCollectionRef.current = null;
      labelCollectionRef.current = null;
      trailCollectionRef.current = null;
      routeCollectionRef.current = null;
      flightMapRef.current.clear();
      initRef.current = false;
    };
  }, [viewer]);

  // Occlusion check: is position on the far side of the globe?
  const isOccluded = useCallback((position: Cartesian3): boolean => {
    if (!viewer) return false;
    const cameraPos = viewer.camera.positionWC;
    const camNorm = Cartesian3.normalize(cameraPos, _scratchCamNorm);
    const posNorm = Cartesian3.normalize(position, _scratchPosNorm);
    return Cartesian3.dot(camNorm, posNorm) < -0.1;
  }, [viewer]);

  // Update billboards/labels/polylines when flight data or filters change
  useEffect(() => {
    const bbCollection = billboardCollectionRef.current;
    const lblCollection = labelCollectionRef.current;
    const trailCollection = trailCollectionRef.current;
    const routeCollection = routeCollectionRef.current;
    if (!bbCollection || !lblCollection || !trailCollection || !routeCollection || !viewer || viewer.isDestroyed()) return;

    const iconUrl = getAircraftIconUrl();
    if (!iconUrl) return;

    const existingMap = flightMapRef.current;
    const currentIds = new Set<string>();
    const now = Date.now();

    const cameraAlt = viewer.camera.positionCartographic?.height || 20000000;
    const showLabels = cameraAlt < 3000000;

    for (const flight of flights) {
      if (!flight.icao24 || !flight.lat || !flight.lon) continue;
      if (flight.onGround) continue;

      const band = getAltitudeBand(flight.altitudeFeet);
      if (!altitudeFilters[band]) continue;

      currentIds.add(flight.icao24);
      const position = Cartesian3.fromDegrees(flight.lon, flight.lat, flight.altitudeMeters);
      const color = getAltitudeColor(flight.altitudeFeet);
      const scale = getAltitudeScale(flight.altitudeFeet);
      const rotation = -CesiumMath.toRadians(flight.heading || 0);
      const occluded = isOccluded(position);

      const isTracked = trackedEntity?.type === 'aircraft' && trackedEntity?.id === flight.icao24;
      const finalScale = isTracked ? 1.0 : scale;

      if (isTracked) {
        trackingManager.updatePosition(flight.icao24, 'aircraft', flight.lon, flight.lat, flight.altitudeMeters);
      }

      const callsignStr = flight.callsign || flight.icao24;
      const altStr = flight.altitudeFeet > 0 ? ' ' + Math.round(flight.altitudeFeet) + 'ft' : '';
      const spdStr = flight.velocityKnots > 0 ? ' ' + Math.round(flight.velocityKnots) + 'kts' : '';
      const routeStr = (flight.origin && flight.destination) ? '\n' + flight.origin + '-' + flight.destination : '';
      const labelText = callsignStr + altStr + spdStr + routeStr;

      const trailPositions = computeHeadingTrail(
        flight.lon, flight.lat, flight.altitudeMeters,
        flight.heading || 0, flight.velocityMs || 0
      );

      let routePositions: Cartesian3[] = [];
      if (showRoutePaths && flight.origin && flight.destination) {
        const originAirport = findAirport(flight.origin);
        const destAirport = findAirport(flight.destination);
        if (originAirport && destAirport) {
          routePositions = computeRouteArc(
            originAirport.lat, originAirport.lon,
            destAirport.lat, destAirport.lon,
            flight.altitudeMeters || 10000
          );
        }
      }

      const existing = existingMap.get(flight.icao24);
      if (existing) {
        // Update existing billboard with fresh API data
        existing.billboard.position = position;
        existing.billboard.color = color;
        existing.billboard.scale = finalScale;
        existing.billboard.rotation = rotation;
        existing.billboard.show = !occluded;
        existing.billboard.id = { type: 'aircraft', data: flight };
        existing.billboard.disableDepthTestDistance = isTracked ? Number.POSITIVE_INFINITY : 0;

        existing.label.position = position;
        existing.label.text = labelText;
        existing.label.show = !occluded && showLabels;
        existing.label.fillColor = color;

        // Update heading trail
        if (existing.headingTrail) {
          if (trailPositions.length >= 2) {
            existing.headingTrail.positions = trailPositions;
            existing.headingTrail.show = !occluded;
          } else {
            trailCollection.remove(existing.headingTrail);
            existing.headingTrail = null;
          }
        } else if (trailPositions.length >= 2) {
          existing.headingTrail = trailCollection.add({
            positions: trailPositions,
            width: 1.5,
            material: Material.fromType('Color', { color: color.withAlpha(0.4) }),
            show: !occluded,
          });
        }

        // Update route arc
        if (existing.routeArc) {
          if (routePositions.length >= 2 && showRoutePaths) {
            existing.routeArc.positions = routePositions;
            existing.routeArc.show = !occluded;
          } else {
            routeCollection.remove(existing.routeArc);
            existing.routeArc = null;
          }
        } else if (routePositions.length >= 2 && showRoutePaths) {
          existing.routeArc = routeCollection.add({
            positions: routePositions,
            width: 1.5,
            material: Material.fromType('Color', { color: COLOR_CYAN.withAlpha(0.6) }),
            show: !occluded,
          });
        }

        // Update dead reckoning base state with fresh API data
        existing.flight = flight;
        existing.position = position;
        existing.baseLat = flight.lat;
        existing.baseLon = flight.lon;
        existing.baseAlt = flight.altitudeMeters;
        existing.heading = flight.heading || 0;
        existing.velocityMs = flight.velocityMs || 0;
        existing.verticalRate = flight.verticalRate || 0;
        existing.lastDataTime = now;
        existing.drLat = flight.lat;
        existing.drLon = flight.lon;
        existing.drAlt = flight.altitudeMeters;
      } else {
        // Add new billboard
        const bb = bbCollection.add({
          position,
          image: iconUrl,
          scale: finalScale,
          color,
          rotation,
          verticalOrigin: VerticalOrigin.CENTER,
          horizontalOrigin: HorizontalOrigin.CENTER,
          show: !occluded,
          id: { type: 'aircraft', data: flight },
          disableDepthTestDistance: isTracked ? Number.POSITIVE_INFINITY : 0,
        });

        const lbl = lblCollection.add({
          position,
          text: labelText,
          font: '10px monospace',
          fillColor: color,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          horizontalOrigin: HorizontalOrigin.LEFT,
          pixelOffset: new Cartesian2(10, -4),
          scale: 0.9,
          show: !occluded && showLabels,
          showBackground: true,
          backgroundColor: Color.BLACK.withAlpha(0.5),
        });

        let headingTrail: Polyline | null = null;
        if (trailPositions.length >= 2) {
          headingTrail = trailCollection.add({
            positions: trailPositions,
            width: 1.5,
            material: Material.fromType('Color', { color: color.withAlpha(0.4) }),
            show: !occluded,
          });
        }

        let routeArc: Polyline | null = null;
        if (routePositions.length >= 2 && showRoutePaths) {
          routeArc = routeCollection.add({
            positions: routePositions,
            width: 1.5,
            material: Material.fromType('Color', { color: COLOR_CYAN.withAlpha(0.6) }),
            show: !occluded,
          });
        }

        existingMap.set(flight.icao24, {
          billboard: bb,
          label: lbl,
          flight,
          position,
          headingTrail,
          routeArc,
          // Initialize dead reckoning state
          baseLat: flight.lat,
          baseLon: flight.lon,
          baseAlt: flight.altitudeMeters,
          heading: flight.heading || 0,
          velocityMs: flight.velocityMs || 0,
          verticalRate: flight.verticalRate || 0,
          lastDataTime: now,
          drLat: flight.lat,
          drLon: flight.lon,
          drAlt: flight.altitudeMeters,
        });
      }
    }

    // Remove stale aircraft no longer in the data
    const toRemove: string[] = [];
    existingMap.forEach((_entry, icao24) => {
      if (!currentIds.has(icao24)) {
        toRemove.push(icao24);
      }
    });
    for (const id of toRemove) {
      const entry = existingMap.get(id);
      if (entry) {
        bbCollection.remove(entry.billboard);
        lblCollection.remove(entry.label);
        if (entry.headingTrail) trailCollection.remove(entry.headingTrail);
        if (entry.routeArc) routeCollection.remove(entry.routeArc);
        existingMap.delete(id);
      }
    }
  }, [flights, altitudeFilters, showRoutePaths, trackedEntity, viewer, isOccluded]);

  // Dead reckoning + occlusion preRender loop
  // Tracked aircraft: update every frame for smooth camera following
  // Non-tracked aircraft: bulk update every 1s for position interpolation
  // Occlusion checks at 1Hz for all aircraft
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    if (preRenderRef.current) {
      viewer.scene.preRender.removeEventListener(preRenderRef.current);
      preRenderRef.current = null;
    }

    let lastBulkDR = 0;        // Last bulk dead reckoning update
    let lastOcclusion = 0;      // Last occlusion check

    const onPreRender = () => {
      const now = Date.now();
      const map = flightMapRef.current;
      if (map.size === 0) return;

      const tracked = trackedEntityRef.current;
      const trackedId = (tracked?.type === 'aircraft') ? tracked.id : null;

      // --- Tracked aircraft: update every frame ---
      if (trackedId) {
        const entry = map.get(trackedId);
        if (entry && entry.velocityMs > 1) {
          const dtSeconds = (now - entry.lastDataTime) / 1000;
          const dr = deadReckonPosition(
            entry.baseLat, entry.baseLon, entry.baseAlt,
            entry.heading, entry.velocityMs, entry.verticalRate,
            dtSeconds
          );
          entry.drLat = dr.lat;
          entry.drLon = dr.lon;
          entry.drAlt = dr.alt;
          const newPos = Cartesian3.fromDegrees(dr.lon, dr.lat, dr.alt);
          entry.position = newPos;
          entry.billboard.position = newPos;
          entry.label.position = newPos;
          // Update tracking manager for smooth camera following
          trackingManager.updatePosition(trackedId, 'aircraft', dr.lon, dr.lat, dr.alt);
          // Update heading trail from dead-reckoned position
          if (entry.headingTrail) {
            const trailPositions = computeHeadingTrail(
              dr.lon, dr.lat, dr.alt,
              entry.heading, entry.velocityMs
            );
            if (trailPositions.length >= 2) {
              entry.headingTrail.positions = trailPositions;
            }
          }
        }
      }

      // --- Non-tracked aircraft: bulk update every 1s ---
      if (now - lastBulkDR >= DR_BULK_INTERVAL) {
        lastBulkDR = now;
        map.forEach((entry, icao24) => {
          if (icao24 === trackedId) return; // Skip tracked (already updated above)
          if (entry.velocityMs < 1) return; // Skip stationary
          const dtSeconds = (now - entry.lastDataTime) / 1000;
          const dr = deadReckonPosition(
            entry.baseLat, entry.baseLon, entry.baseAlt,
            entry.heading, entry.velocityMs, entry.verticalRate,
            dtSeconds
          );
          entry.drLat = dr.lat;
          entry.drLon = dr.lon;
          entry.drAlt = dr.alt;
          const newPos = Cartesian3.fromDegrees(dr.lon, dr.lat, dr.alt);
          entry.position = newPos;
          entry.billboard.position = newPos;
          entry.label.position = newPos;
          // Update heading trail from dead-reckoned position
          if (entry.headingTrail) {
            const trailPositions = computeHeadingTrail(
              dr.lon, dr.lat, dr.alt,
              entry.heading, entry.velocityMs
            );
            if (trailPositions.length >= 2) {
              entry.headingTrail.positions = trailPositions;
            }
          }
        });
      }

      // --- Occlusion + label visibility at 1Hz ---
      if (now - lastOcclusion >= OCCLUSION_INTERVAL) {
        lastOcclusion = now;
        const cameraAlt = viewer.camera.positionCartographic?.height || 20000000;
        const showLabels = cameraAlt < 3000000;
        map.forEach((entry) => {
          const occluded = isOccluded(entry.position);
          entry.billboard.show = !occluded;
          entry.label.show = !occluded && showLabels;
          if (entry.headingTrail) entry.headingTrail.show = !occluded;
          if (entry.routeArc) entry.routeArc.show = !occluded;
        });
      }
    };

    viewer.scene.preRender.addEventListener(onPreRender);
    preRenderRef.current = onPreRender;

    return () => {
      if (preRenderRef.current && viewer && !viewer.isDestroyed()) {
        viewer.scene.preRender.removeEventListener(preRenderRef.current);
        preRenderRef.current = null;
      }
    };
  }, [viewer, isOccluded]);

  return null;
}

// Scratch Cartesian3 objects to avoid allocations in hot path
const _scratchCamNorm = new Cartesian3();
const _scratchPosNorm = new Cartesian3();
