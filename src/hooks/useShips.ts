import { useState, useEffect, useRef, useCallback } from 'react';
import type { ShipData } from '../types';

/**
 * useShips - Polls /api/ships every 30s with exponential backoff
 * AIS vessel data via burst collection pattern.
 * Filters: moving vessels only (SOG >0.5), exclude (0,0) coordinates.
 */
export function useShips(enabled: boolean) {
  const [ships, setShips] = useState<ShipData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchShips = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ships');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Filter: moving vessels only, exclude (0,0)
      const filtered = (Array.isArray(data) ? data : []).filter(
        (s: ShipData) => s.sog > 0.5 && !(s.lat === 0 && s.lon === 0)
      );
      setShips(filtered);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setShips([]);
      return;
    }

    fetchShips();
    intervalRef.current = setInterval(fetchShips, 30_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, fetchShips]);

  return { ships, loading, error };
}
