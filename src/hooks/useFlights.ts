import { useState, useEffect, useRef } from 'react';
import type { FlightData } from '../types';

/**
 * useFlights - Polls /api/flights every 20s with exponential backoff
 * Returns global flight data from FR24 (7 regional zones) with adsb.fi fallback.
 * Backoff: 30s start, doubles on error, caps at 2min. Resets on success.
 * AbortController cancels in-flight requests when layer is disabled mid-fetch.
 */
export function useFlights(enabled: boolean) {
  const [flights, setFlights] = useState<FlightData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(20_000); // Normal: 20s
  const BASE_INTERVAL = 20_000;
  const ERROR_START = 30_000;
  const ERROR_CAP = 120_000;

  useEffect(() => {
    if (!enabled) {
      setFlights([]);
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();

    const fetchFlights = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/flights', { signal: abortController.signal });
        if (cancelled) return; // Discard result if disabled during fetch
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return; // Discard result if disabled during JSON parse
        setFlights(Array.isArray(data) ? data : []);
        setError(null);
        backoffRef.current = BASE_INTERVAL;
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
        backoffRef.current = Math.min(backoffRef.current * 2, ERROR_CAP);
        if (backoffRef.current < ERROR_START) backoffRef.current = ERROR_START;
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchFlights();

    const poll = () => {
      if (cancelled) return;
      intervalRef.current = setTimeout(() => {
        if (cancelled) return;
        fetchFlights().then(() => {
          if (!cancelled) poll();
        });
      }, backoffRef.current);
    };
    poll();

    return () => {
      cancelled = true;
      abortController.abort();
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [enabled]);

  return { flights, loading, error };
}
