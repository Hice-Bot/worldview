import { useEffect, useRef, useCallback } from 'react';
import { useCesium } from 'resium';
import {
  Cartesian2,
  Cartesian3,
  Color,
  BillboardCollection,
  LabelCollection,
  LabelStyle,
  VerticalOrigin,
  HorizontalOrigin,
  Math as CesiumMath,
  Billboard,
  Label,
} from 'cesium';
import type { FlightData, AltitudeFilters, TrackedEntityInfo } from '../../types';
import { trackingManager } from '../../trackingManager';

interface FlightLayerProps {
  flights: FlightData[];
  altitudeFilters: AltitudeFilters;
  showRoutePaths: boolean;
  trackedEntity: TrackedEntityInfo | null;
}

// --- Altitude band classification with colors ---
// Cruise >=35,000ft = cyan, High >=20,000ft = light blue, Mid >=10,000ft = gold,
// Low >=3,000ft = orange, Ground <3,000ft = red
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

// --- Altitude band name for filtering ---
function getAltitudeBand(altFeet: number): keyof AltitudeFilters {
  if (altFeet >= 35000) return 'cruise';
  if (altFeet >= 20000) return 'high';
  if (altFeet >= 10000) return 'mid';
  if (altFeet >= 3000) return 'low';
  return 'ground';
}

// --- Billboard scale varies inversely with altitude ---
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

  // Draw airplane from top-down: fuselage + wings + tail (pointing up = north)
  ctx.beginPath();
  ctx.moveTo(16, 2);   // nose
  ctx.lineTo(18, 8);
  ctx.lineTo(18, 12);
  ctx.lineTo(30, 16);  // right wing tip
  ctx.lineTo(30, 18);
  ctx.lineTo(18, 16);
  ctx.lineTo(18, 24);
  ctx.lineTo(24, 28);  // right tail
  ctx.lineTo(24, 30);
  ctx.lineTo(18, 27);
  ctx.lineTo(16, 30);  // bottom
  ctx.lineTo(14, 27);
  ctx.lineTo(8, 30);   // left tail
  ctx.lineTo(8, 28);
  ctx.lineTo(14, 24);
  ctx.lineTo(14, 16);
  ctx.lineTo(2, 18);   // left wing tip
  ctx.lineTo(2, 16);
  ctx.lineTo(14, 12);
  ctx.lineTo(14, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  cachedIconDataUrl = canvas.toDataURL('image/png');
  return cachedIconDataUrl;
}

// Map to track per-aircraft billboard/label state
interface FlightEntry {
  billboard: Billboard;
  label: Label;
  flight: FlightData;
  position: Cartesian3;
}

/**
 * FlightLayer - Renders aircraft using imperative Cesium BillboardCollection + LabelCollection.
 * Altitude band coloring: Cruise=cyan, High=light blue, Mid=gold, Low=orange, Ground=red.
 * Billboard scale varies inversely with altitude.
 * Far-side occlusion via dot-product hemisphere check.
 * Incremental add/update/remove via ICAO24 keyed map.
 */
export default function FlightLayer({ flights, altitudeFilters, showRoutePaths: _showRoutePaths, trackedEntity }: FlightLayerProps) {
  const { viewer } = useCesium();
  const billboardCollectionRef = useRef<BillboardCollection | null>(null);
  const labelCollectionRef = useRef<LabelCollection | null>(null);
  const flightMapRef = useRef<Map<string, FlightEntry>>(new Map());
  const initRef = useRef(false);
  const preRenderRef = useRef<(() => void) | null>(null);

  // Create collections once when viewer is available
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || initRef.current) return;

    const bbCollection = new BillboardCollection({ scene: viewer.scene });
    const lblCollection = new LabelCollection({ scene: viewer.scene });

    viewer.scene.primitives.add(bbCollection);
    viewer.scene.primitives.add(lblCollection);

    billboardCollectionRef.current = bbCollection;
    labelCollectionRef.current = lblCollection;
    initRef.current = true;

    return () => {
      if (viewer && !viewer.isDestroyed()) {
        if (billboardCollectionRef.current) {
          viewer.scene.primitives.remove(billboardCollectionRef.current);
        }
        if (labelCollectionRef.current) {
          viewer.scene.primitives.remove(labelCollectionRef.current);
        }
      }
      billboardCollectionRef.current = null;
      labelCollectionRef.current = null;
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

  // Update billboards/labels when flight data or filters change
  useEffect(() => {
    const bbCollection = billboardCollectionRef.current;
    const lblCollection = labelCollectionRef.current;
    if (!bbCollection || !lblCollection || !viewer || viewer.isDestroyed()) return;

    const iconUrl = getAircraftIconUrl();
    if (!iconUrl) return;

    const existingMap = flightMapRef.current;
    const currentIds = new Set<string>();

    // Get camera altitude for label visibility
    const cameraAlt = viewer.camera.positionCartographic?.height || 20000000;
    const showLabels = cameraAlt < 3000000;

    for (const flight of flights) {
      if (!flight.icao24 || !flight.lat || !flight.lon) continue;
      if (flight.onGround) continue;

      // Apply altitude filters
      const band = getAltitudeBand(flight.altitudeFeet);
      if (!altitudeFilters[band]) continue;

      currentIds.add(flight.icao24);
      const position = Cartesian3.fromDegrees(flight.lon, flight.lat, flight.altitudeMeters);
      const color = getAltitudeColor(flight.altitudeFeet);
      const scale = getAltitudeScale(flight.altitudeFeet);
      const rotation = -CesiumMath.toRadians(flight.heading || 0);
      const occluded = isOccluded(position);

      // Check if this is the tracked aircraft
      const isTracked = trackedEntity?.type === 'aircraft' && trackedEntity?.id === flight.icao24;
      const finalScale = isTracked ? 1.0 : scale;

      // Update tracking manager position for camera following (dead reckoning)
      if (isTracked) {
        trackingManager.updatePosition(flight.icao24, 'aircraft', flight.lon, flight.lat, flight.altitudeMeters);
      }

      // Build label text
      const labelText = flight.callsign || flight.icao24;
      const altStr = flight.altitudeFeet > 0 ? ' FL' + Math.round(flight.altitudeFeet / 100) : '';

      const existing = existingMap.get(flight.icao24);
      if (existing) {
        // Update existing billboard
        existing.billboard.position = position;
        existing.billboard.color = color;
        existing.billboard.scale = finalScale;
        existing.billboard.rotation = rotation;
        existing.billboard.show = !occluded;
        existing.billboard.id = { type: 'aircraft', data: flight };
        if (isTracked) {
          existing.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
        } else {
          existing.billboard.disableDepthTestDistance = 0;
        }

        // Update label
        existing.label.position = position;
        existing.label.text = labelText + altStr;
        existing.label.show = !occluded && showLabels;
        existing.label.fillColor = color;

        existing.flight = flight;
        existing.position = position;
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

        // Add label
        const lbl = lblCollection.add({
          position,
          text: labelText + altStr,
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

        existingMap.set(flight.icao24, {
          billboard: bb,
          label: lbl,
          flight,
          position,
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
        existingMap.delete(id);
      }
    }
  }, [flights, altitudeFilters, trackedEntity, viewer, isOccluded]);

  // Update occlusion + label visibility on camera move (throttled to 1Hz)
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Remove old listener
    if (preRenderRef.current) {
      viewer.scene.preRender.removeEventListener(preRenderRef.current);
      preRenderRef.current = null;
    }

    let lastUpdate = 0;
    const onPreRender = () => {
      const now = Date.now();
      if (now - lastUpdate < 1000) return; // 1Hz throttle
      lastUpdate = now;

      const cameraAlt = viewer.camera.positionCartographic?.height || 20000000;
      const showLabels = cameraAlt < 3000000;
      const map = flightMapRef.current;

      map.forEach((entry) => {
        const occluded = isOccluded(entry.position);
        entry.billboard.show = !occluded;
        entry.label.show = !occluded && showLabels;
      });
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
