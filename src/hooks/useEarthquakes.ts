import { useState, useEffect, useRef, useCallback } from 'react';
import type { EarthquakeData } from '../types';

/**
 * useEarthquakes - Polls /api/earthquakes every 60s
 * Exponential backoff on error: 60s start, doubles each failure, caps at 2min.
 * Resets to normal 60s interval on successful fetch. USGS M2.5+ day feed.
 */
export function useEarthquakes(enabled: boolean) {
  const [earthquakes, setEarthquakes] = useState<EarthquakeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(60_000); // Normal: 60s
  const BASE_INTERVAL = 60_000;
  const ERROR_START = 60_000;
  const ERROR_CAP = 120_000;

  const fetchEarthquakes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/earthquakes');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Parse GeoJSON features into EarthquakeData
      const features = data?.features ?? [];
      const parsed: EarthquakeData[] = features.map((f: Record<string, unknown>) => {
        const props = f.properties as Record<string, unknown>;
        const geo = f.geometry as { coordinates: number[] };
        return {
          id: f.id as string,
          magnitude: props.mag as number,
          depth: geo.coordinates[2] as number,
          lon: geo.coordinates[0] as number,
          lat: geo.coordinates[1] as number,
          place: props.place as string,
          time: props.time as number,
          url: props.url as string,
        };
      });
      setEarthquakes(parsed);
      setError(null);
      backoffRef.current = BASE_INTERVAL; // Reset on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      backoffRef.current = Math.min(backoffRef.current * 2, ERROR_CAP);
      if (backoffRef.current < ERROR_START) backoffRef.current = ERROR_START;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setEarthquakes([]);
      return;
    }

    fetchEarthquakes();

    const poll = () => {
      timeoutRef.current = setTimeout(() => {
        fetchEarthquakes().then(poll);
      }, backoffRef.current);
    };
    poll();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enabled, fetchEarthquakes]);

  return { earthquakes, loading, error };
}
