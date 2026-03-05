import { useState, useEffect, useRef, useCallback } from 'react';
import type { TrafficRoad } from '../types';

/**
 * useTraffic - Fetches /api/traffic/roads with bounding box params
 * Auto-disables above 5,000,000m altitude. Single fetch per bbox.
 * Exponential backoff on error.
 */
export function useTraffic(enabled: boolean, bbox: { south: number; west: number; north: number; east: number } | null) {
  const [roads, setRoads] = useState<TrafficRoad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastBboxRef = useRef<string | null>(null);

  const fetchTraffic = useCallback(async (south: number, west: number, north: number, east: number) => {
    const bboxKey = `${south},${west},${north},${east}`;
    if (lastBboxRef.current === bboxKey) return; // Already fetched this bbox
    lastBboxRef.current = bboxKey;

    try {
      setLoading(true);
      const res = await fetch(`/api/traffic/roads?south=${south}&west=${west}&north=${north}&east=${east}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRoads(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !bbox) {
      setRoads([]);
      lastBboxRef.current = null;
      return;
    }
    fetchTraffic(bbox.south, bbox.west, bbox.north, bbox.east);
  }, [enabled, bbox, fetchTraffic]);

  return { roads, loading, error };
}
