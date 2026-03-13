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
  NearFarScalar,
  Billboard,
  Label,
  Material,
} from 'cesium';
import type { ShipData, TrackedEntityInfo } from '../../types';
import { trackingManager } from '../../trackingManager';

interface ShipLayerProps {
  ships: ShipData[];
  trackedEntity: TrackedEntityInfo | null;
}

// --- Constants ---
const EARTH_RADIUS = 6371000; // meters
const KNOTS_TO_MS = 0.514444; // knots to m/s conversion
const DR_BULK_INTERVAL = 2000; // Dead reckoning bulk update: 2s for non-tracked vessels
const BLEND_DURATION_MS = 1500; // Smooth blend from old DR to new API position (1.5s)
const OCCLUSION_INTERVAL = 500; // Occlusion check: 2Hz
const MIN_SOG_FOR_TRAIL = 0.5; // Minimum SOG (knots) to show vessel trail
const TRAIL_LENGTH_SECONDS = 120; // Trail shows 2 minutes of past position
const TRAIL_POINTS = 10; // Number of points in the trail polyline

// ============================================================================
// AIS Ship Type Classification → Color
// ============================================================================
const SHIP_COLORS: Record<string, Color> = {
  cargo:      Color.CYAN,
  tanker:     Color.ORANGE,
  passenger:  Color.fromCssColorString('#39FF14'),
  highspeed:  Color.YELLOW,
  pleasure:   Color.fromCssColorString('#B266FF'),
  fishing:    Color.TEAL,
  military:   Color.RED,
  tug:        Color.fromCssColorString('#8B4513'),
  other:      Color.fromCssColorString('#AAAAAA'),
};

function getShipTypeCategory(shipType: number): string {
  if (shipType >= 70 && shipType <= 79) return 'cargo';
  if (shipType >= 80 && shipType <= 89) return 'tanker';
  if (shipType >= 60 && shipType <= 69) return 'passenger';
  if (shipType >= 40 && shipType <= 49) return 'highspeed';
  if (shipType === 37) return 'pleasure';
  if (shipType === 30) return 'fishing';
  if (shipType === 35) return 'military';
  if (shipType === 31 || shipType === 32) return 'tug';
  if (shipType === 52) return 'tug';
  return 'other';
}

function getShipColor(shipType: number): Color {
  const category = getShipTypeCategory(shipType);
  const color = SHIP_COLORS[category];
  return color !== undefined ? color : SHIP_COLORS.other as Color;
}

// ============================================================================
// Canvas-drawn 28x28 top-down vessel silhouette (white, pointing north)
// ============================================================================
let cachedVesselIconUrl: string | null = null;

function getVesselIconUrl(): string {
  if (cachedVesselIconUrl) return cachedVesselIconUrl;

  const size = 28;
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
  ctx.moveTo(14, 1);
  ctx.lineTo(19, 8);
  ctx.lineTo(20, 12);
  ctx.lineTo(20, 20);
  ctx.lineTo(19, 24);
  ctx.lineTo(18, 26);
  ctx.lineTo(10, 26);
  ctx.lineTo(9, 24);
  ctx.lineTo(8, 20);
  ctx.lineTo(8, 12);
  ctx.lineTo(9, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#CCCCCC';
  ctx.fillRect(11, 14, 6, 5);
  ctx.strokeRect(11, 14, 6, 5);

  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(11.5, 15.5);
  ctx.lineTo(16.5, 15.5);
  ctx.stroke();

  cachedVesselIconUrl = canvas.toDataURL('image/png');
  return cachedVesselIconUrl;
}

// ============================================================================
// Dead reckoning: extrapolate ship position using heading + speed (knots)
// Uses great-circle forward projection on Earth's surface at sea level
// ============================================================================
function deadReckonShipPosition(
  baseLat: number,
  baseLon: number,
  headingDeg: number,
  sogKnots: number,
  dtSeconds: number
): { lat: number; lon: number } {
  // Convert speed over ground from knots to m/s
  const velocityMs = sogKnots * KNOTS_TO_MS;

  if (velocityMs < 0.5 || dtSeconds <= 0) {
    return { lat: baseLat, lon: baseLon };
  }

  // Clamp dt to avoid runaway extrapolation (max 60s for ships with 30s poll interval)
  const dt = Math.min(dtSeconds, 60);
  const distanceMeters = velocityMs * dt;
  const dOverR = distanceMeters / EARTH_RADIUS;

  // Use COG (course over ground) for direction of travel
  const headingRad = CesiumMath.toRadians(headingDeg);
  const latRad = CesiumMath.toRadians(baseLat);
  const lonRad = CesiumMath.toRadians(baseLon);

  // Great-circle forward projection (trigonometric displacement)
  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(dOverR) +
    Math.cos(latRad) * Math.sin(dOverR) * Math.cos(headingRad)
  );
  const newLonRad = lonRad + Math.atan2(
    Math.sin(headingRad) * Math.sin(dOverR) * Math.cos(latRad),
    Math.cos(dOverR) - Math.sin(latRad) * Math.sin(newLatRad)
  );

  return {
    lat: CesiumMath.toDegrees(newLatRad),
    lon: CesiumMath.toDegrees(newLonRad),
  };
}

// ============================================================================
// Per-ship tracking entry with dead reckoning state
// ============================================================================
interface ShipEntry {
  billboard: Billboard;
  label: Label;
  ship: ShipData;
  position: Cartesian3;
  // Dead reckoning state
  baseLat: number;
  baseLon: number;
  heading: number;      // COG or heading in degrees
  sogKnots: number;     // Speed over ground in knots
  lastDataTime: number; // Timestamp when data was received from API
  drLat: number;        // Current dead-reckoned latitude
  drLon: number;        // Current dead-reckoned longitude
  // Smooth blending state — prevents jumps when new data arrives
  blendStartLat: number;
  blendStartLon: number;
  blendStartTime: number;
  blendActive: boolean;
  // Trail state
  trail: any | null;    // Reference to Polyline in PolylineCollection, null if no trail
}

// ============================================================================
// Generate trail positions: reverse dead reckoning from current position
// Shows where the vessel has been based on its heading + speed
// ============================================================================
function generateTrailPositions(
  lat: number,
  lon: number,
  headingDeg: number,
  sogKnots: number
): Cartesian3[] {
  if (sogKnots < MIN_SOG_FOR_TRAIL) return [];

  const positions: Cartesian3[] = [];
  // Reverse heading (180 degrees opposite) to trace backward path
  const reverseHeading = (headingDeg + 180) % 360;

  for (let i = TRAIL_POINTS; i >= 0; i--) {
    const pastSeconds = (i / TRAIL_POINTS) * TRAIL_LENGTH_SECONDS;
    if (pastSeconds === 0) {
      positions.push(Cartesian3.fromDegrees(lon, lat, 0));
    } else {
      const pastPos = deadReckonShipPosition(lat, lon, reverseHeading, sogKnots, pastSeconds);
      positions.push(Cartesian3.fromDegrees(pastPos.lon, pastPos.lat, 0));
    }
  }

  return positions;
}

// Scratch Cartesian3 for occlusion checks
const _scratchCamNorm = new Cartesian3();
const _scratchPosNorm = new Cartesian3();

/**
 * ShipLayer - AIS vessel tracking via imperative Cesium primitive collections.
 * BillboardCollection + LabelCollection + PolylineCollection.
 * Dead reckoning interpolation: tracked vessel every frame, others every 2s.
 * Color by AIS ship type code.
 * Far-side occlusion via dot-product hemisphere check.
 */
export default function ShipLayer({ ships, trackedEntity }: ShipLayerProps) {
  const { viewer } = useCesium();
  const billboardCollectionRef = useRef<BillboardCollection | null>(null);
  const labelCollectionRef = useRef<LabelCollection | null>(null);
  const trailCollectionRef = useRef<PolylineCollection | null>(null);
  const shipMapRef = useRef<Map<string, ShipEntry>>(new Map());
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

    viewer.scene.primitives.add(bbCollection);
    viewer.scene.primitives.add(lblCollection);
    viewer.scene.primitives.add(trailCollection);

    billboardCollectionRef.current = bbCollection;
    labelCollectionRef.current = lblCollection;
    trailCollectionRef.current = trailCollection;
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
      }
      billboardCollectionRef.current = null;
      labelCollectionRef.current = null;
      trailCollectionRef.current = null;
      shipMapRef.current.clear();
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

  // Update billboards/labels/trails when ship data changes
  useEffect(() => {
    const bbCollection = billboardCollectionRef.current;
    const lblCollection = labelCollectionRef.current;
    const trailCollection = trailCollectionRef.current;
    if (!bbCollection || !lblCollection || !viewer || viewer.isDestroyed()) return;

    const iconUrl = getVesselIconUrl();
    if (!iconUrl) return;

    const existingMap = shipMapRef.current;
    const currentIds = new Set<string>();
    const now = Date.now();

    const cameraAlt = viewer.camera.positionCartographic?.height || 20000000;
    const showLabels = cameraAlt < 3000000;
    const showTrails = cameraAlt < 500000; // Only show trails when zoomed in close

    for (const ship of ships) {
      if (!ship.mmsi || !ship.lat || !ship.lon) continue;

      currentIds.add(ship.mmsi);

      const position = Cartesian3.fromDegrees(ship.lon, ship.lat, 0);
      const color = getShipColor(ship.shipType);
      const rotation = -CesiumMath.toRadians(ship.heading || ship.cog || 0);
      const occluded = isOccluded(position);

      const isTracked = trackedEntity?.type === 'ship' && trackedEntity?.id === ship.mmsi;
      const finalScale = isTracked ? 1.5 : 0.6;
      const finalColor = isTracked ? Color.fromCssColorString('#FF3B30') : color;

      if (isTracked) {
        trackingManager.updatePosition(ship.mmsi, 'ship', ship.lon, ship.lat, 0);
      }

      const vesselName = ship.name || ship.mmsi;
      const sogStr = ship.sog > 0 ? ` ${ship.sog.toFixed(1)}kn` : '';
      const destStr = ship.destination ? ` → ${ship.destination}` : '';
      const labelText = vesselName + sogStr + destStr;

      // Use COG for dead reckoning direction (more reliable than heading for moving ships)
      const drHeading = ship.cog > 0 ? ship.cog : (ship.heading || 0);

      const existing = existingMap.get(ship.mmsi);
      if (existing) {
        // Update existing billboard with fresh API data
        existing.billboard.position = position;
        existing.billboard.color = finalColor;
        existing.billboard.scale = finalScale;
        existing.billboard.rotation = rotation;
        existing.billboard.show = !occluded;
        existing.billboard.id = { type: 'ship', data: ship };
        existing.billboard.disableDepthTestDistance = isTracked ? Number.POSITIVE_INFINITY : 0;

        existing.label.position = position;
        existing.label.text = labelText;
        existing.label.show = !occluded && showLabels;
        existing.label.fillColor = finalColor;

        // Update dead reckoning base state with fresh API data
        // Smooth blending: record current DR position as blend start to avoid visible jumps
        existing.ship = ship;
        existing.position = position;
        existing.blendStartLat = existing.drLat;
        existing.blendStartLon = existing.drLon;
        existing.blendStartTime = now;
        existing.blendActive = true;
        // Update base to new API data for future DR extrapolation
        existing.baseLat = ship.lat;
        existing.baseLon = ship.lon;
        existing.heading = drHeading;
        existing.sogKnots = ship.sog || 0;
        existing.lastDataTime = now;
        // Don't snap drLat/drLon — let the preRender blend handle the transition

        // Update trail: only for moving vessels (SOG > 0.5 kt) when zoomed in
        if (trailCollection) {
          const shouldHaveTrail = showTrails && (ship.sog || 0) > MIN_SOG_FOR_TRAIL;
          if (shouldHaveTrail) {
            const trailPositions = generateTrailPositions(ship.lat, ship.lon, drHeading, ship.sog || 0);
            if (trailPositions.length > 1) {
              if (existing.trail) {
                // Update existing trail
                try {
                  existing.trail.positions = trailPositions;
                  existing.trail.show = !occluded;
                } catch {
                  // Trail reference invalid, will recreate
                  existing.trail = null;
                }
              }
              if (!existing.trail) {
                // Create new trail
                existing.trail = trailCollection.add({
                  positions: trailPositions,
                  width: 1.5,
                  material: Material.fromType('Color', {
                    color: color.withAlpha(0.4),
                  }),
                  show: !occluded,
                });
              }
            }
          } else if (existing.trail) {
            // Hide trail for stopped vessel or when zoomed out
            try {
              existing.trail.show = false;
            } catch { /* ignore */ }
          }
        }
      } else {
        // Add new billboard
        const bb = bbCollection.add({
          position,
          image: iconUrl,
          scale: finalScale,
          color: finalColor,
          rotation,
          verticalOrigin: VerticalOrigin.CENTER,
          horizontalOrigin: HorizontalOrigin.CENTER,
          show: !occluded,
          id: { type: 'ship', data: ship },
          disableDepthTestDistance: isTracked ? Number.POSITIVE_INFINITY : 0,
        });

        const lbl = lblCollection.add({
          position,
          text: labelText,
          font: '10px monospace',
          fillColor: finalColor,
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
          // Distance-based label fading: full opacity at 5km, fades to 0 at 500km
          translucencyByDistance: new NearFarScalar(5000, 1.0, 500000, 0.0),
        });

        // Create trail for moving vessels only (when zoomed in)
        let trailRef: any = null;
        if (trailCollection && showTrails && (ship.sog || 0) > MIN_SOG_FOR_TRAIL) {
          const trailPositions = generateTrailPositions(ship.lat, ship.lon, drHeading, ship.sog || 0);
          if (trailPositions.length > 1) {
            trailRef = trailCollection.add({
              positions: trailPositions,
              width: 1.5,
              material: Material.fromType('Color', {
                color: color.withAlpha(0.4),
              }),
              show: !occluded,
            });
          }
        }

        existingMap.set(ship.mmsi, {
          billboard: bb,
          label: lbl,
          ship,
          position,
          // Initialize dead reckoning state
          baseLat: ship.lat,
          baseLon: ship.lon,
          heading: drHeading,
          sogKnots: ship.sog || 0,
          lastDataTime: now,
          drLat: ship.lat,
          drLon: ship.lon,
          // No blend needed for new ships
          blendStartLat: ship.lat,
          blendStartLon: ship.lon,
          blendStartTime: now,
          blendActive: false,
          trail: trailRef,
        });
      }
    }

    // Remove stale ships no longer in the data
    // Preserve tracked entity across data gaps (Feature #183) — don't remove if currently tracked
    const trackedMmsi = (trackedEntity?.type === 'ship') ? trackedEntity.id : null;
    const toRemove: string[] = [];
    existingMap.forEach((_entry, mmsi) => {
      if (!currentIds.has(mmsi) && mmsi !== trackedMmsi) {
        toRemove.push(mmsi);
      }
    });
    for (const id of toRemove) {
      const entry = existingMap.get(id);
      if (entry) {
        bbCollection.remove(entry.billboard);
        lblCollection.remove(entry.label);
        if (entry.trail && trailCollection) {
          try { trailCollection.remove(entry.trail); } catch { /* ignore */ }
        }
        existingMap.delete(id);
      }
    }
  }, [ships, trackedEntity, viewer, isOccluded]);

  // Dead reckoning + occlusion preRender loop
  // Tracked vessel: update every frame for smooth camera following
  // Other vessels: bulk update every 2s for position interpolation
  // Occlusion checks at 2Hz for all vessels
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    if (preRenderRef.current) {
      viewer.scene.preRender.removeEventListener(preRenderRef.current);
      preRenderRef.current = null;
    }

    let lastBulkDR = 0;
    let lastOcclusion = 0;

    const onPreRender = () => {
      const now = Date.now();
      const map = shipMapRef.current;
      if (map.size === 0) return;

      const tracked = trackedEntityRef.current;
      const trackedId = (tracked?.type === 'ship') ? tracked.id : null;

      // --- Tracked vessel: update every frame ---
      if (trackedId) {
        const entry = map.get(trackedId);
        if (entry && entry.sogKnots > 0.5) {
          const dtSeconds = (now - entry.lastDataTime) / 1000;
          const dr = deadReckonShipPosition(
            entry.baseLat, entry.baseLon,
            entry.heading, entry.sogKnots,
            dtSeconds
          );

          // Smooth blending: interpolate from old DR position to new DR target
          let finalLat = dr.lat;
          let finalLon = dr.lon;
          if (entry.blendActive) {
            const blendElapsed = now - entry.blendStartTime;
            if (blendElapsed < BLEND_DURATION_MS) {
              const t = blendElapsed / BLEND_DURATION_MS;
              const ease = t * (2 - t); // ease-out quadratic
              finalLat = entry.blendStartLat + (dr.lat - entry.blendStartLat) * ease;
              finalLon = entry.blendStartLon + (dr.lon - entry.blendStartLon) * ease;
            } else {
              entry.blendActive = false; // Blend complete
            }
          }

          entry.drLat = finalLat;
          entry.drLon = finalLon;
          const newPos = Cartesian3.fromDegrees(finalLon, finalLat, 0);
          entry.position = newPos;
          entry.billboard.position = newPos;
          entry.label.position = newPos;
          // Update tracking manager for smooth camera following
          trackingManager.updatePosition(trackedId, 'ship', finalLon, finalLat, 0);
        }
      }

      // --- Other vessels: bulk update every 2s ---
      if (now - lastBulkDR >= DR_BULK_INTERVAL) {
        lastBulkDR = now;
        map.forEach((entry, mmsi) => {
          if (mmsi === trackedId) return; // Skip tracked (already updated above)
          if (entry.sogKnots < 0.5) return; // Skip stationary/very slow vessels
          const dtSeconds = (now - entry.lastDataTime) / 1000;
          const dr = deadReckonShipPosition(
            entry.baseLat, entry.baseLon,
            entry.heading, entry.sogKnots,
            dtSeconds
          );
          entry.drLat = dr.lat;
          entry.drLon = dr.lon;
          const newPos = Cartesian3.fromDegrees(dr.lon, dr.lat, 0);
          entry.position = newPos;
          entry.billboard.position = newPos;
          entry.label.position = newPos;
        });
      }

      // --- Occlusion + label visibility at 2Hz ---
      if (now - lastOcclusion >= OCCLUSION_INTERVAL) {
        lastOcclusion = now;
        const cameraAlt = viewer.camera.positionCartographic?.height || 20000000;
        const showLabels = cameraAlt < 3000000;
        map.forEach((entry) => {
          const occluded = isOccluded(entry.position);
          entry.billboard.show = !occluded;
          entry.label.show = !occluded && showLabels;
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
