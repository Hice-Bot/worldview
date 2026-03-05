import { useEffect, useRef } from 'react';
import { useCesium } from 'resium';
import type { SatelliteData, SatelliteFilters } from '../../types';

interface SatelliteLayerProps {
  satellites: SatelliteData[];
  filters: SatelliteFilters;
}

/**
 * SatelliteLayer - Client-side orbital propagation using satellite.js
 * Parses TLE data, computes positions via SGP4/SDP4, renders as Resium Entity components.
 * Two propagation cycles: orbit paths (30s), current positions (2s/5Hz).
 * Canvas-drawn icons with rotation by bearing.
 */
export default function SatelliteLayer({ satellites, filters }: SatelliteLayerProps) {
  const { viewer } = useCesium();
  const propagationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const orbitIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!viewer) return;

    // TODO: Parse TLE data into satrec objects
    // TODO: Start 5Hz position propagation
    // TODO: Start 30s orbit path computation
    // TODO: Render satellite entities with canvas-drawn icons
    // TODO: Implement orbit paths, ground tracks, nadir lines
    // TODO: Implement EllipsoidalOccluder

    return () => {
      if (propagationIntervalRef.current) clearInterval(propagationIntervalRef.current);
      if (orbitIntervalRef.current) clearInterval(orbitIntervalRef.current);
    };
  }, [viewer, satellites, filters]);

  return null;
}
