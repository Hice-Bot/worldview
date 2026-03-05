import { useState, useEffect, useRef, useCallback } from 'react';
import type { FlightData } from '../types';

/**
 * useFlights - Polls /api/flights every 20s with exponential backoff
 * Returns global flight data from FR24 (7 regional zones) with adsb.fi fallback.
 * Backoff: 30s start, doubles on error, caps at 2min. Resets on success.
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

  const fetchFlights = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/flights');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFlights(Array.isArray(data) ? data : []);
      setError(null);
      backoffRef.current = BASE_INTERVAL;
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
      setFlights([]);
      return;
    }

    fetchFlights();

    const poll = () => {
      intervalRef.current = setTimeout(() => {
        fetchFlights().then(poll);
      }, backoffRef.current);
    };
    poll();

    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [enabled, fetchFlights]);

  return { flights, loading, error };
}
