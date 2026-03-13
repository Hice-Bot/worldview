import { useState, useEffect, useRef } from 'react';
import type { SatelliteData } from '../types';

/**
 * useSatellites - Fetches TLE data from /api/satellites
 * Exponential backoff on error: 120s start, doubles each failure, caps at 2min.
 * Resets to normal 2hr interval on successful fetch.
 * TLE data cached for 2 hours on backend.
 * AbortController cancels in-flight requests when layer is disabled mid-fetch.
 */
export function useSatellites(enabled: boolean) {
  const [satellites, setSatellites] = useState<SatelliteData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(7_200_000); // Normal: 2 hours (matches backend cache TTL)
  const BASE_INTERVAL = 7_200_000; // 2 hours
  const ERROR_START = 120_000; // 2min on first error
  const ERROR_CAP = 120_000; // Cap at 2min

  useEffect(() => {
    if (!enabled) {
      setSatellites([]);
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();

    const fetchSatellites = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/satellites', { signal: abortController.signal });
        if (cancelled) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setSatellites(Array.isArray(data) ? data : []);
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

    fetchSatellites();

    const poll = () => {
      if (cancelled) return;
      timeoutRef.current = setTimeout(() => {
        if (cancelled) return;
        fetchSatellites().then(() => {
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

  return { satellites, loading, error };
}
