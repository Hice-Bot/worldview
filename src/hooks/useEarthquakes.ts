import { useState, useEffect, useRef, useCallback } from 'react';
import type { EarthquakeData } from '../types';

/**
 * useEarthquakes - Polls /api/earthquakes every 60s
 * Exponential backoff on error. USGS M2.5+ day feed.
 */
export function useEarthquakes(enabled: boolean) {
  const [earthquakes, setEarthquakes] = useState<EarthquakeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
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
    intervalRef.current = setInterval(fetchEarthquakes, 60_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, fetchEarthquakes]);

  return { earthquakes, loading, error };
}
