import { useEffect, useCallback } from 'react';
import { useCesium } from 'resium';
import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartesian2,
  Cartesian3,
  defined,
} from 'cesium';
import type { EntityType, TrackedEntityInfo, CameraData } from '../../types';

interface EntityClickHandlerProps {
  onTrackEntity: (entity: TrackedEntityInfo | null) => void;
  onCctvClick: (camera: CameraData | null) => void;
}

// Helper entity keywords that should be deprioritized
const HELPER_KEYWORDS = ['orbit', 'trail', 'nadir', 'ground track', 'path', 'route'];

/**
 * Checks if a string contains any helper entity keywords
 */
function isHelperEntity(text: string): boolean {
  const lower = text.toLowerCase();
  return HELPER_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Extracts a searchable text blob from a picked entity/primitive for classification
 */
function getEntityText(picked: unknown): string {
  const parts: string[] = [];

  // Try to get entity name, description, and properties
  const obj = picked as Record<string, unknown>;

  // Resium/Cesium Entity
  if (obj.id && typeof obj.id === 'object') {
    const entity = obj.id as Record<string, unknown>;
    if (entity.name) parts.push(String(entity.name));
    if (entity.description) {
      const desc = entity.description;
      if (typeof desc === 'string') {
        parts.push(desc);
      } else if (desc && typeof desc === 'object' && 'getValue' in desc) {
        try {
          parts.push(String((desc as { getValue: () => unknown }).getValue()));
        } catch {
          // ignore
        }
      }
    }
    // Check entity properties bag
    if (entity.properties && typeof entity.properties === 'object') {
      const props = entity.properties as Record<string, unknown>;
      for (const key of Object.keys(props)) {
        parts.push(key);
        try {
          const val = props[key];
          if (val && typeof val === 'object' && 'getValue' in val) {
            parts.push(String((val as { getValue: () => unknown }).getValue()));
          } else if (val !== undefined && val !== null) {
            parts.push(String(val));
          }
        } catch {
          // ignore
        }
      }
    }
  }

  // Primitive with description or other fields
  if (obj.primitive && typeof obj.primitive === 'object') {
    const prim = obj.primitive as Record<string, unknown>;
    if (prim.name) parts.push(String(prim.name));
    if (prim.id) parts.push(String(prim.id));
  }

  // Billboard/Label with id
  if (obj.id && typeof obj.id === 'string') {
    parts.push(obj.id);
  }

  return parts.join(' ');
}

/**
 * Gets entity data as a flat record for TrackedEntityInfo
 */
function getEntityData(picked: unknown): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const obj = picked as Record<string, unknown>;

  if (obj.id && typeof obj.id === 'object') {
    const entity = obj.id as Record<string, unknown>;
    if (entity.name) data.name = String(entity.name);

    if (entity.properties && typeof entity.properties === 'object') {
      const props = entity.properties as Record<string, unknown>;
      for (const key of Object.keys(props)) {
        try {
          const val = props[key];
          if (val && typeof val === 'object' && 'getValue' in val) {
            data[key] = (val as { getValue: () => unknown }).getValue();
          } else if (val !== undefined && val !== null) {
            data[key] = val;
          }
        } catch {
          // ignore
        }
      }
    }
  }

  return data;
}

/**
 * Classifies an entity based on keyword inspection of its text content
 */
function classifyEntity(text: string, picked: unknown): EntityType | null {
  const lower = text.toLowerCase();

  // Check for CCTV first via duck-typing
  if (isCctvEntity(picked)) {
    return 'cctv';
  }

  // Satellite: norad, iss, altitude with km
  if (
    lower.includes('norad') ||
    lower.includes('iss') ||
    /altitude.*km/i.test(text) ||
    lower.includes('satellite') ||
    lower.includes('tle')
  ) {
    return 'satellite';
  }

  // Aircraft: callsign, icao24, aircraft, squawk
  if (
    lower.includes('callsign') ||
    lower.includes('icao24') ||
    lower.includes('aircraft') ||
    lower.includes('squawk') ||
    lower.includes('flight')
  ) {
    return 'aircraft';
  }

  // Ship: mmsi, imo:, call sign, destination
  if (
    lower.includes('mmsi') ||
    lower.includes('imo:') ||
    lower.includes('call sign') ||
    lower.includes('destination') ||
    lower.includes('vessel')
  ) {
    return 'ship';
  }

  // Earthquake: magnitude, depth
  if (lower.includes('magnitude') || lower.includes('depth') || lower.includes('earthquake') || lower.includes('seismic')) {
    return 'earthquake';
  }

  return null;
}

/**
 * Duck-type check for CCTV entity: object with lat/lon/source/name properties
 */
function isCctvEntity(picked: unknown): boolean {
  const obj = picked as Record<string, unknown>;

  // Check entity properties for CCTV-like structure
  if (obj.id && typeof obj.id === 'object') {
    const entity = obj.id as Record<string, unknown>;
    if (entity.properties && typeof entity.properties === 'object') {
      const props = entity.properties as Record<string, unknown>;
      const keys = Object.keys(props);
      const hasLat = keys.some((k) => k.toLowerCase().includes('lat'));
      const hasLon = keys.some((k) => k.toLowerCase().includes('lon'));
      const hasSource = keys.some((k) => k.toLowerCase().includes('source') || k.toLowerCase().includes('region'));
      const hasName = keys.some((k) => k.toLowerCase() === 'name' || k.toLowerCase().includes('camera'));
      return hasLat && hasLon && (hasSource || hasName);
    }
  }

  return false;
}

/**
 * Extracts CameraData from a CCTV entity
 */
function extractCameraData(picked: unknown): CameraData | null {
  const data = getEntityData(picked);
  if (data.lat && data.lon) {
    return {
      id: String(data.id || data.name || ''),
      name: String(data.name || ''),
      lat: Number(data.lat),
      lon: Number(data.lon),
      imageUrl: String(data.imageUrl || ''),
      available: Boolean(data.available ?? true),
      region: String(data.region || ''),
      country: String(data.country || ''),
      direction: String(data.direction || ''),
    };
  }
  return null;
}

/**
 * Gets entity name for display
 */
function getEntityName(picked: unknown): string {
  const obj = picked as Record<string, unknown>;
  if (obj.id && typeof obj.id === 'object') {
    const entity = obj.id as Record<string, unknown>;
    if (entity.name) return String(entity.name);
  }
  if (obj.id && typeof obj.id === 'string') return obj.id;
  return 'Unknown Entity';
}

/**
 * Gets entity ID string
 */
function getEntityId(picked: unknown): string {
  const obj = picked as Record<string, unknown>;
  if (obj.id && typeof obj.id === 'object') {
    const entity = obj.id as Record<string, unknown>;
    if (entity.id) return String(entity.id);
    if (entity.name) return String(entity.name);
  }
  if (obj.id && typeof obj.id === 'string') return obj.id;
  return `entity-${Date.now()}`;
}

// Type-specific viewFrom offsets for camera lock-on
const VIEW_FROM_OFFSETS: Record<EntityType, Cartesian3> = {
  satellite: new Cartesian3(0, -500000, 500000),   // ~700km
  aircraft: new Cartesian3(0, -30000, 30000),       // ~42km
  ship: new Cartesian3(0, -1200, 2100),             // ~2.4km
  earthquake: new Cartesian3(0, -200000, 200000),   // ~280km
  cctv: new Cartesian3(0, -200000, 200000),         // ~280km
};

/**
 * EntityClickHandler - Handles click detection and camera lock-on
 * Uses Cesium scene.drillPick to detect clicked entities,
 * classifies them by type via keyword inspection, and
 * triggers camera lock-on with type-specific viewFrom offsets.
 */
export default function EntityClickHandler({ onTrackEntity, onCctvClick }: EntityClickHandlerProps) {
  const { viewer } = useCesium();

  const handleClick = useCallback(
    (movement: { position: Cartesian2 }) => {
      if (!viewer) return;

      const scene = viewer.scene;
      const position = movement.position;

      // Step 1: drillPick with limit 10
      let picks = scene.drillPick(position, 10);

      // Step 2: Filter and prioritize - real data entities over helper entities
      if (picks.length > 0) {
        const realEntities = picks.filter((p: unknown) => {
          const text = getEntityText(p);
          return text.length > 0 && !isHelperEntity(text);
        });

        // Use real entities if any found, otherwise use all picks
        if (realEntities.length > 0) {
          picks = realEntities;
        }
      }

      // Step 3: Falls back to scene.pick if drillPick yields no results
      if (picks.length === 0) {
        const singlePick = scene.pick(position);
        if (defined(singlePick)) {
          picks = [singlePick];
        }
      }

      // No entities found - click on empty space, unlock tracking
      if (picks.length === 0) {
        onTrackEntity(null);
        onCctvClick(null);
        // Untrack entity in viewer
        if (viewer.trackedEntity) {
          viewer.trackedEntity = undefined;
        }
        return;
      }

      // Use the first (highest priority) pick
      const picked = picks[0] as unknown;
      const text = getEntityText(picked);
      const entityType = classifyEntity(text, picked);

      if (!entityType) {
        // Unknown entity type - untrack
        onTrackEntity(null);
        onCctvClick(null);
        return;
      }

      // Handle CCTV entities separately
      if (entityType === 'cctv') {
        const cameraData = extractCameraData(picked);
        onCctvClick(cameraData);
        return;
      }

      // Build TrackedEntityInfo
      const trackedInfo: TrackedEntityInfo = {
        type: entityType,
        id: getEntityId(picked),
        name: getEntityName(picked),
        data: getEntityData(picked),
      };

      onTrackEntity(trackedInfo);

      // Camera lock-on: set viewFrom offset on the Cesium entity
      const obj = picked as Record<string, unknown>;
      if (obj.id && typeof obj.id === 'object') {
        const cesiumEntity = obj.id as Record<string, unknown>;
        if ('viewFrom' in cesiumEntity) {
          (cesiumEntity as { viewFrom: Cartesian3 }).viewFrom = VIEW_FROM_OFFSETS[entityType];
        }
        // Set as tracked entity for camera follow
        try {
          viewer.trackedEntity = cesiumEntity as never;
        } catch {
          // Entity may not be trackable
        }
      }
    },
    [viewer, onTrackEntity, onCctvClick]
  );

  useEffect(() => {
    if (!viewer) return;

    // Create ScreenSpaceEventHandler for click events
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    // Left click: detect and classify entities
    handler.setInputAction(
      handleClick,
      ScreenSpaceEventType.LEFT_CLICK
    );

    // ESC key handler to unlock tracking
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onTrackEntity(null);
        onCctvClick(null);
        if (viewer.trackedEntity) {
          viewer.trackedEntity = undefined;
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      handler.destroy();
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewer, handleClick, onTrackEntity, onCctvClick]);

  return null;
}
