import { useState, useEffect, useRef } from 'react';
import type { ShipData } from '../types';

/**
 * useShips - Polls /api/ships every 30s with exponential backoff
 * Backoff: 30s start on error, doubles each failure, caps at 2min.
 * Resets to normal 30s interval on successful fetch.
 * AIS vessel data via burst collection pattern.
 * Filters: moving vessels only (SOG >0.5), exclude (0,0) coordinates.
 * AbortController cancels in-flight requests when layer is disabled mid-fetch.
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

  useEffect(() => {
    if (!enabled) {
      setShips([]);
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();

    const fetchShips = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/ships', { signal: abortController.signal });
        if (cancelled) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        // Filter: moving vessels only, exclude (0,0)
        const filtered = (Array.isArray(data) ? data : []).filter(
          (s: ShipData) => s.sog > 0.5 && !(s.lat === 0 && s.lon === 0)
        );
        setShips(filtered);
        setError(null);
        backoffRef.current = BASE_INTERVAL; // Reset on success
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
        backoffRef.current = Math.min(backoffRef.current * 2, ERROR_CAP);
        if (backoffRef.current < ERROR_START) backoffRef.current = ERROR_START;
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchShips();

    const poll = () => {
      if (cancelled) return;
      timeoutRef.current = setTimeout(() => {
        if (cancelled) return;
        fetchShips().then(() => {
          if (!cancelled) poll();
        });
      }, backoffRef.current);
    };
    poll();

    return () => {
      cancelled = true;
      abortController.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enabled]);

  return { ships, loading, error };
}
