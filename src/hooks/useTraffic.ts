import { useState, useEffect, useRef } from 'react';
import type { TrafficRoad } from '../types';

/**
 * useTraffic - Fetches /api/traffic/roads with bounding box params
 * Auto-disables above 5,000,000m altitude. Single fetch per bbox.
 * 1s debounce prevents fetch abortion during camera interaction.
 * Exponential backoff on error: 30s start, doubles each failure, caps at 2min.
 * Resets lastBboxRef on error to allow retry with same bbox.
 * AbortController cancels in-flight requests when layer is disabled mid-fetch.
 */
export function useTraffic(enabled: boolean, bbox: { south: number; west: number; north: number; east: number } | null) {
  const [roads, setRoads] = useState<TrafficRoad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastBboxRef = useRef<string | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const backoffRef = useRef(0);
  const ERROR_START = 30_000;
  const ERROR_CAP = 120_000;
  const DEBOUNCE_MS = 1000;

  useEffect(() => {
    if (!enabled || !bbox) {
      setRoads([]);
      lastBboxRef.current = null;
      return;
    }

    const { south, west, north, east } = bbox;

    // Round to 3 decimal places (~100m) to reduce churn from tiny camera movements
    const rS = Math.round(south * 1000) / 1000;
    const rW = Math.round(west * 1000) / 1000;
    const rN = Math.round(north * 1000) / 1000;
    const rE = Math.round(east * 1000) / 1000;

    const bboxKey = `${rS},${rW},${rN},${rE}`;
    if (lastBboxRef.current === bboxKey) return; // Already fetched this bbox

    // Debounce: wait for camera to stop moving before fetching
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      // Abort any previous in-flight request
      if (abortRef.current) abortRef.current.abort();
      const abortController = new AbortController();
      abortRef.current = abortController;

      lastBboxRef.current = bboxKey;
      let cancelled = false;

      const fetchTraffic = async () => {
        try {
          setLoading(true);
          const res = await fetch(
            `/api/traffic/roads?south=${rS}&west=${rW}&north=${rN}&east=${rE}`,
            { signal: abortController.signal }
          );
          if (cancelled) return;
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (cancelled) return;
          setRoads(Array.isArray(data) ? data : []);
          setError(null);
          backoffRef.current = 0; // Reset on success
        } catch (err) {
          if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
          setError(err instanceof Error ? err.message : 'Unknown error');
          // Allow retry with same bbox by clearing lastBboxRef
          lastBboxRef.current = null;
          backoffRef.current = Math.min(
            (backoffRef.current || ERROR_START) * 2,
            ERROR_CAP
          );
          if (backoffRef.current < ERROR_START) backoffRef.current = ERROR_START;
          // Schedule retry with backoff
          if (!cancelled) {
            retryTimeoutRef.current = setTimeout(() => {
              if (!cancelled) fetchTraffic();
            }, backoffRef.current);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      };

      fetchTraffic();

      // Return cleanup for the debounce closure (captured by effect cleanup below)
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [enabled, bbox]);

  return { roads, loading, error };
}
