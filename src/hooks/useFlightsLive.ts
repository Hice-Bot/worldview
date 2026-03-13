import { useState, useEffect, useRef } from 'react';
import type { FlightData } from '../types';

/**
 * useFlightsLive - Polls /api/flights/live every 5s for zoomed-in regional data
 * Uses lat/lon/distance from camera state. Designed for adsb.fi regional API.
 * 4s cache TTL on backend means data is near-real-time.
 * AbortController cancels in-flight requests when layer is disabled mid-fetch.
 */
export function useFlightsLive(enabled: boolean, lat: number, lon: number, distanceNm: number = 100) {
  const [flights, setFlights] = useState<FlightData[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setFlights([]);
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();

    const fetchLive = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/flights/live?lat=${lat}&lon=${lon}&dist=${distanceNm}`, { signal: abortController.signal });
        if (cancelled) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setFlights(Array.isArray(data) ? data : []);
      } catch {
        // Silent failure - live data is supplementary (includes AbortError)
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLive();
    intervalRef.current = setInterval(fetchLive, 5000);

    return () => {
      cancelled = true;
      abortController.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, lat, lon, distanceNm]);

  return { flights, loading };
}
