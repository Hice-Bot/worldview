import { useState, useEffect, useRef } from 'react';
import type { CameraData } from '../types';

/**
 * useCameras - Polls /api/cctv every 5 minutes with exponential backoff
 * Backoff: 60s start on error, doubles each failure, caps at 2min.
 * Resets to normal 5min interval on successful fetch.
 * Supports country-based filtering via query parameter.
 * AbortController cancels in-flight requests when layer is disabled mid-fetch.
 */
export function useCameras(enabled: boolean, country?: string) {
  const [cameras, setCameras] = useState<CameraData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(300_000); // Normal: 5 minutes
  const BASE_INTERVAL = 300_000;
  const ERROR_START = 60_000;
  const ERROR_CAP = 120_000;

  useEffect(() => {
    if (!enabled) {
      setCameras([]);
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();

    const fetchCameras = async () => {
      try {
        setLoading(true);
        const params = country ? `?country=${country}` : '';
        const res = await fetch(`/api/cctv${params}`, { signal: abortController.signal });
        if (cancelled) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setCameras(Array.isArray(data) ? data : []);
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

    fetchCameras();

    const poll = () => {
      if (cancelled) return;
      timeoutRef.current = setTimeout(() => {
        if (cancelled) return;
        fetchCameras().then(() => {
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
  }, [enabled, country]);

  return { cameras, loading, error };
}
