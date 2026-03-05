import { useState, useEffect, useRef, useCallback } from 'react';
import type { FlightData } from '../types';

/**
 * useFlightsLive - Polls /api/flights/live every 5s for zoomed-in regional data
 * Uses lat/lon/distance from camera state. Designed for adsb.fi regional API.
 * 4s cache TTL on backend means data is near-real-time.
 */
export function useFlightsLive(enabled: boolean, lat: number, lon: number, distanceNm: number = 100) {
  const [flights, setFlights] = useState<FlightData[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLive = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/flights/live?lat=${lat}&lon=${lon}&dist=${distanceNm}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFlights(Array.isArray(data) ? data : []);
    } catch {
      // Silent failure - live data is supplementary
    } finally {
      setLoading(false);
    }
  }, [lat, lon, distanceNm]);

  useEffect(() => {
    if (!enabled) {
      setFlights([]);
      return;
    }

    fetchLive();
    intervalRef.current = setInterval(fetchLive, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, fetchLive]);

  return { flights, loading };
}
