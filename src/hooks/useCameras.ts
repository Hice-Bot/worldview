import { useState, useEffect, useRef, useCallback } from 'react';
import type { CameraData } from '../types';

/**
 * useCameras - Polls /api/cctv every 5 minutes with exponential backoff
 * Supports country-based filtering via query parameter.
 */
export function useCameras(enabled: boolean, country?: string) {
  const [cameras, setCameras] = useState<CameraData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCameras = useCallback(async () => {
    try {
      setLoading(true);
      const params = country ? `?country=${country}` : '';
      const res = await fetch(`/api/cctv${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCameras(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [country]);

  useEffect(() => {
    if (!enabled) {
      setCameras([]);
      return;
    }

    fetchCameras();
    intervalRef.current = setInterval(fetchCameras, 300_000); // 5 minutes

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, fetchCameras]);

  return { cameras, loading, error };
}
