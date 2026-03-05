import { useEffect, useRef } from 'react';
import { useCesium } from 'resium';
import type { EarthquakeData } from '../../types';

interface EarthquakeLayerProps {
  earthquakes: EarthquakeData[];
}

/**
 * EarthquakeLayer - Pulsing seismic activity markers
 * Magnitude-based color and size, sinusoidal pulsing animation
 * with per-earthquake phase offsets.
 */
export default function EarthquakeLayer({ earthquakes }: EarthquakeLayerProps) {
  const { viewer } = useCesium();
  const entitiesRef = useRef<unknown[]>([]);

  useEffect(() => {
    if (!viewer) return;

    // TODO: Create Cesium point primitives with CallbackProperty for pulsing
    // TODO: Magnitude-based color and size
    // TODO: Individual phase offsets from earthquake ID hash
    // TODO: Labels for M4.5+ events

    return () => {
      // Cleanup entities
    };
  }, [viewer, earthquakes]);

  return null;
}
