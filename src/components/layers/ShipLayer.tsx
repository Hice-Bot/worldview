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
  Billboard,
  Label,
} from 'cesium';
import type { ShipData, TrackedEntityInfo } from '../../types';
import { trackingManager } from '../../trackingManager';

interface ShipLayerProps {
  ships: ShipData[];
  trackedEntity: TrackedEntityInfo | null;
}

// ============================================================================
// AIS Ship Type Classification → Color
// ============================================================================
// AIS ship type first digit: 3=special, 4=high-speed, 5=special, 6=passenger,
// 7=cargo, 8=tanker, 9=other
// Second digit: additional cargo/hazard classification

const SHIP_COLORS: Record<string, Color> = {
  cargo:      Color.CYAN,                              // 70-79
  tanker:     Color.ORANGE,                             // 80-89
  passenger:  Color.fromCssColorString('#39FF14'),      // 60-69 green
  highspeed:  Color.YELLOW,                             // 40-49
  pleasure:   Color.fromCssColorString('#B266FF'),      // 37 pleasure craft, purple
  fishing:    Color.TEAL,                               // 30 fishing
  military:   Color.RED,                                // 35 military
  tug:        Color.fromCssColorString('#8B4513'),      // 31-32 towing/tug, brown
  other:      Color.fromCssColorString('#AAAAAA'),      // everything else, gray
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
  if (shipType === 52) return 'tug'; // port tender/tug
  return 'other';
}

function getShipColor(shipType: number): Color {
  return SHIP_COLORS[getShipTypeCategory(shipType)] || SHIP_COLORS.other;
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

  // Top-down ship silhouette pointing north (up)
  // Pointed bow at top, wider stern at bottom
  ctx.beginPath();
  ctx.moveTo(14, 1);   // bow (center top)
  ctx.lineTo(19, 8);   // starboard bow
  ctx.lineTo(20, 12);  // starboard midship
  ctx.lineTo(20, 20);  // starboard aft
  ctx.lineTo(19, 24);  // starboard quarter
  ctx.lineTo(18, 26);  // starboard stern
  ctx.lineTo(10, 26);  // port stern
  ctx.lineTo(9, 24);   // port quarter
  ctx.lineTo(8, 20);   // port aft
  ctx.lineTo(8, 12);   // port midship
  ctx.lineTo(9, 8);    // port bow
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Superstructure detail (small rectangle at mid-aft)
  ctx.fillStyle = '#CCCCCC';
  ctx.fillRect(11, 14, 6, 5);
  ctx.strokeRect(11, 14, 6, 5);

  // Bridge window line
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
// Per-ship tracking entry
// ============================================================================
interface ShipEntry {
  billboard: Billboard;
  label: Label;
  ship: ShipData;
  position: Cartesian3;
}

// Scratch Cartesian3 for occlusion checks
const _scratchCamNorm = new Cartesian3();
const _scratchPosNorm = new Cartesian3();

/**
 * ShipLayer - AIS vessel tracking via imperative Cesium primitive collections
 * BillboardCollection + LabelCollection + PolylineCollection.
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

  // Update billboards/labels when ship data changes
  useEffect(() => {
    const bbCollection = billboardCollectionRef.current;
    const lblCollection = labelCollectionRef.current;
    if (!bbCollection || !lblCollection || !viewer || viewer.isDestroyed()) return;

    const iconUrl = getVesselIconUrl();
    if (!iconUrl) return;

    const existingMap = shipMapRef.current;
    const currentIds = new Set<string>();

    // Camera altitude for label visibility
    const cameraAlt = viewer.camera.positionCartographic?.height || 20000000;
    const showLabels = cameraAlt < 3000000;

    for (const ship of ships) {
      if (!ship.mmsi || !ship.lat || !ship.lon) continue;

      currentIds.add(ship.mmsi);

      // Ship positions are at sea level (0m altitude)
      const position = Cartesian3.fromDegrees(ship.lon, ship.lat, 0);
      const color = getShipColor(ship.shipType);
      const rotation = -CesiumMath.toRadians(ship.heading || ship.cog || 0);
      const occluded = isOccluded(position);

      // Check if this is the tracked ship
      const isTracked = trackedEntity?.type === 'ship' && trackedEntity?.id === ship.mmsi;
      const finalScale = isTracked ? 1.5 : 0.6;
      const finalColor = isTracked ? Color.fromCssColorString('#FF3B30') : color;

      // Update tracking manager position for camera following
      if (isTracked) {
        trackingManager.updatePosition(ship.mmsi, 'ship', ship.lon, ship.lat, 0);
      }

      // Build label text
      const labelText = ship.name || ship.mmsi;
      const sogStr = ship.sog > 0 ? ` ${ship.sog.toFixed(1)}kn` : '';

      const existing = existingMap.get(ship.mmsi);
      if (existing) {
        // Update existing
        existing.billboard.position = position;
        existing.billboard.color = finalColor;
        existing.billboard.scale = finalScale;
        existing.billboard.rotation = rotation;
        existing.billboard.show = !occluded;
        existing.billboard.id = { type: 'ship', data: ship };
        existing.billboard.disableDepthTestDistance = isTracked ? Number.POSITIVE_INFINITY : 0;

        existing.label.position = position;
        existing.label.text = labelText + sogStr;
        existing.label.show = !occluded && showLabels;
        existing.label.fillColor = finalColor;

        existing.ship = ship;
        existing.position = position;
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

        // Add label
        const lbl = lblCollection.add({
          position,
          text: labelText + sogStr,
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
        });

        existingMap.set(ship.mmsi, {
          billboard: bb,
          label: lbl,
          ship,
          position,
        });
      }
    }

    // Remove stale ships no longer in the data
    const toRemove: string[] = [];
    existingMap.forEach((_entry, mmsi) => {
      if (!currentIds.has(mmsi)) {
        toRemove.push(mmsi);
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
  }, [ships, trackedEntity, viewer, isOccluded]);

  // Occlusion + label visibility updates on camera move (throttled to 2Hz)
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    if (preRenderRef.current) {
      viewer.scene.preRender.removeEventListener(preRenderRef.current);
      preRenderRef.current = null;
    }

    let lastUpdate = 0;
    const onPreRender = () => {
      const now = Date.now();
      if (now - lastUpdate < 500) return; // 2Hz throttle
      lastUpdate = now;

      const cameraAlt = viewer.camera.positionCartographic?.height || 20000000;
      const showLabels = cameraAlt < 3000000;
      const map = shipMapRef.current;

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
