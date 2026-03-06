import { useState, useEffect, useRef, useCallback } from 'react';
import type { ShipData } from '../types';

/**
 * useShips - Polls /api/ships every 30s with exponential backoff
 * Backoff: 30s start on error, doubles each failure, caps at 2min.
 * Resets to normal 30s interval on successful fetch.
 * AIS vessel data via burst collection pattern.
 * Filters: moving vessels only (SOG >0.5), exclude (0,0) coordinates.
 */
export function useShips(enabled: boolean) {
  const [ships, setShips] = useState<ShipData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(30_000); // Normal: 30s
  const BASE_INTERVAL = 30_000;
  const ERROR_START = 30_000;
  const ERROR_CAP = 120_000;

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
      setShips([]);
      return;
    }

    fetchShips();

    const poll = () => {
      timeoutRef.current = setTimeout(() => {
        fetchShips().then(poll);
      }, backoffRef.current);
    };
    poll();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enabled, fetchShips]);

  return { ships, loading, error };
}
