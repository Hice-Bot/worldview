import { useEffect, useRef } from 'react';
import { useCesium } from 'resium';
import {
  Cartesian2,
  Cartesian3,
  Color,
  LabelCollection,
  LabelStyle,
  PointPrimitiveCollection,
  PointPrimitive,
  VerticalOrigin,
  HorizontalOrigin,
} from 'cesium';
import type { EarthquakeData, TrackedEntityInfo } from '../../types';

interface EarthquakeLayerProps {
  earthquakes: EarthquakeData[];
  trackedEntity?: TrackedEntityInfo | null;
}

// --- Magnitude-based color mapping ---
// 6+ red, 5-6 orange, 4-5 yellow, 3-4 orange 80% alpha, <3 orange 40% alpha
function getMagnitudeColor(mag: number): Color {
  if (mag >= 6) return Color.RED;
  if (mag >= 5) return Color.ORANGE;
  if (mag >= 4) return Color.YELLOW;
  if (mag >= 3) return Color.ORANGE.withAlpha(0.8);
  return Color.ORANGE.withAlpha(0.4);
}

// --- Magnitude-based base size ---
// 3px (low) to 14px (M6+)
function getMagnitudeSize(mag: number): number {
  if (mag >= 6) return 14;
  if (mag >= 5) return 11;
  if (mag >= 4) return 8;
  if (mag >= 3) return 5;
  return 3;
}

// --- Pulse amplitude: higher magnitude = larger pulse ---
function getPulseAmplitude(mag: number): number {
  if (mag >= 6) return 6;
  if (mag >= 5) return 4;
  if (mag >= 4) return 3;
  if (mag >= 3) return 2;
  return 1;
}

// --- Pulse speed: higher magnitude = faster ---
function getPulseSpeed(mag: number): number {
  if (mag >= 6) return 3.0;
  if (mag >= 5) return 2.5;
  if (mag >= 4) return 2.0;
  if (mag >= 3) return 1.5;
  return 1.0;
}

// --- Phase offset from earthquake ID hash to prevent synchronized pulsing ---
function hashIdToPhase(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return (Math.abs(hash) % 1000) / 1000 * Math.PI * 2;
}

interface QuakePointData {
  point: PointPrimitive;
  baseSize: number;
  amplitude: number;
  speed: number;
  phase: number;
}

/**
 * EarthquakeLayer - Pulsing seismic activity markers
 * Uses PointPrimitiveCollection for performance.
 * Sinusoidal pulsing animation with per-earthquake phase offsets.
 * Magnitude-based color and size. Filters M2.5+.
 * Labels for M4.5+ events showing magnitude and place, hidden during tracking.
 */
export default function EarthquakeLayer({ earthquakes, trackedEntity }: EarthquakeLayerProps) {
  const { viewer } = useCesium();
  const collectionRef = useRef<PointPrimitiveCollection | null>(null);
  const labelCollectionRef = useRef<LabelCollection | null>(null);
  const quakePointsRef = useRef<QuakePointData[]>([]);
  const preRenderRef = useRef<(() => void) | null>(null);

  // Create/update point primitives and labels when earthquakes change
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Remove old collections if they exist
    if (collectionRef.current) {
      viewer.scene.primitives.remove(collectionRef.current);
      collectionRef.current = null;
    }
    if (labelCollectionRef.current) {
      viewer.scene.primitives.remove(labelCollectionRef.current);
      labelCollectionRef.current = null;
    }
    quakePointsRef.current = [];

    // Filter M2.5+ earthquakes
    const filtered = earthquakes.filter((eq) => eq.magnitude >= 2.5);
    if (filtered.length === 0) return;

    // Create new PointPrimitiveCollection for seismic markers
    const collection = new PointPrimitiveCollection();
    const quakePoints: QuakePointData[] = [];

    // Create LabelCollection for M4.5+ earthquake labels
    const labelCollection = new LabelCollection({
      scene: viewer.scene,
    });

    for (const eq of filtered) {
      const position = Cartesian3.fromDegrees(eq.lon, eq.lat, 0);
      const baseSize = getMagnitudeSize(eq.magnitude);
      const color = getMagnitudeColor(eq.magnitude);
      const amplitude = getPulseAmplitude(eq.magnitude);
      const speed = getPulseSpeed(eq.magnitude);
      const phase = hashIdToPhase(eq.id);

      const point = collection.add({
        position,
        pixelSize: baseSize,
        color,
        outlineColor: Color.BLACK.withAlpha(0.5),
        outlineWidth: 1,
        id: {
          type: 'earthquake',
          data: eq,
        },
      });

      quakePoints.push({ point, baseSize, amplitude, speed, phase });

      // Add label for M4.5+ earthquakes — text from USGS properties.place field
      if (eq.magnitude >= 4.5) {
        labelCollection.add({
          position,
          text: 'M' + eq.magnitude.toFixed(1) + ' ' + eq.place,
          font: '11px monospace',
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          horizontalOrigin: HorizontalOrigin.LEFT,
          pixelOffset: new Cartesian2(8, -4),
          scale: 1.0,
          showBackground: true,
          backgroundColor: Color.BLACK.withAlpha(0.6),
        });
      }
    }

    viewer.scene.primitives.add(collection);
    viewer.scene.primitives.add(labelCollection);
    collectionRef.current = collection;
    labelCollectionRef.current = labelCollection;
    quakePointsRef.current = quakePoints;

    return () => {
      if (collectionRef.current && viewer && !viewer.isDestroyed()) {
        viewer.scene.primitives.remove(collectionRef.current);
        collectionRef.current = null;
      }
      if (labelCollectionRef.current && viewer && !viewer.isDestroyed()) {
        viewer.scene.primitives.remove(labelCollectionRef.current);
        labelCollectionRef.current = null;
      }
      quakePointsRef.current = [];
    };
  }, [viewer, earthquakes]);

  // Hide labels during entity tracking mode (reduce clutter)
  useEffect(() => {
    if (!labelCollectionRef.current) return;
    // When an entity is being tracked, hide earthquake labels
    labelCollectionRef.current.show = !trackedEntity;
  }, [trackedEntity]);

  // Animation loop: sinusoidal pulsing via scene.preRender
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Remove old listener if any
    if (preRenderRef.current) {
      viewer.scene.preRender.removeEventListener(preRenderRef.current);
      preRenderRef.current = null;
    }

    const onPreRender = () => {
      const now = Date.now() / 1000; // seconds
      const points = quakePointsRef.current;
      for (let i = 0; i < points.length; i++) {
        const item = points[i];
        if (!item) continue;
        // Sinusoidal pulsing: size oscillates around baseSize
        const pulse = Math.sin(now * item.speed + item.phase);
        item.point.pixelSize = item.baseSize + pulse * item.amplitude;
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
  }, [viewer, earthquakes]);

  return null;
}
