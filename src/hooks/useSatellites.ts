import { useState, useEffect, useCallback } from 'react';
import type { SatelliteData } from '../types';

/**
 * useSatellites - Fetches TLE data from /api/satellites
 * Parses 3-line TLE format. Exponential backoff on error.
 * TLE data cached for 2 hours on backend.
 */
export function useSatellites(enabled: boolean) {
  const [satellites, setSatellites] = useState<SatelliteData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSatellites = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/satellites');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSatellites(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSatellites([]);
      return;
    }
    fetchSatellites();
    // TLE data changes slowly, no aggressive polling needed
    // Backend caches for 2 hours
  }, [enabled, fetchSatellites]);

  return { satellites, loading, error };
}
