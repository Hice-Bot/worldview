import { useEffect, useCallback, useRef } from 'react';
import { useCesium } from 'resium';
import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartesian2,
  Cartesian3,
  defined,
  CallbackProperty,
  Math as CesiumMath,
} from 'cesium';
import type { EntityType, TrackedEntityInfo, CameraData } from '../../types';
import { trackingManager } from '../../trackingManager';

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
 * Billboard pick structure from BillboardCollection
 */
interface BillboardPickId {
  type: string;
  data: Record<string, unknown>;
}

/**
 * Checks if a picked object is from a BillboardCollection with our id format
 */
function isBillboardPick(picked: unknown): BillboardPickId | null {
  const obj = picked as Record<string, unknown>;
  if (obj.id && typeof obj.id === 'object') {
    const id = obj.id as Record<string, unknown>;
    if (id.type && typeof id.type === 'string' && id.data && typeof id.data === 'object') {
      return id as unknown as BillboardPickId;
    }
  }
  return null;
}

/**
 * Extracts a searchable text blob from a picked entity/primitive for classification
 */
function getEntityText(picked: unknown): string {
  const parts: string[] = [];
  const obj = picked as Record<string, unknown>;

  // Check for billboard pick first
  const bbPick = isBillboardPick(picked);
  if (bbPick) {
    parts.push(bbPick.type);
    const data = bbPick.data;
    for (const key of Object.keys(data)) {
      parts.push(key);
      const val = data[key];
      if (val !== undefined && val !== null && typeof val !== 'object') {
        parts.push(String(val));
      }
    }
    return parts.join(' ');
  }

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

  // Billboard/Label with string id
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

  // Billboard pick — data is directly available
  const bbPick = isBillboardPick(picked);
  if (bbPick) {
    const d = bbPick.data;
    for (const key of Object.keys(d)) {
      const val = d[key];
      if (val !== undefined && val !== null) {
        data[key] = val;
      }
    }
    return data;
  }

  // Cesium Entity
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
 * Classifies an entity based on billboard id type or keyword inspection
 */
function classifyEntity(text: string, picked: unknown): EntityType | null {
  // Billboard pick — use the type field directly
  const bbPick = isBillboardPick(picked);
  if (bbPick) {
    const t = bbPick.type.toLowerCase();
    if (t === 'aircraft' || t === 'flight') return 'aircraft';
    if (t === 'ship' || t === 'vessel') return 'ship';
    if (t === 'cctv' || t === 'camera') return 'cctv';
    if (t === 'earthquake' || t === 'seismic') return 'earthquake';
    if (t === 'satellite') return 'satellite';
  }

  const lower = text.toLowerCase();

  // Check for CCTV first via duck-typing
  if (isCctvEntity(picked)) {
    return 'cctv';
  }

  // Satellite
  if (
    lower.includes('norad') ||
    lower.includes('iss') ||
    /altitude.*km/i.test(text) ||
    lower.includes('satellite') ||
    lower.includes('tle')
  ) {
    return 'satellite';
  }

  // Aircraft
  if (
    lower.includes('callsign') ||
    lower.includes('icao24') ||
    lower.includes('aircraft') ||
    lower.includes('squawk') ||
    lower.includes('flight')
  ) {
    return 'aircraft';
  }

  // Ship
  if (
    lower.includes('mmsi') ||
    lower.includes('imo:') ||
    lower.includes('call sign') ||
    lower.includes('destination') ||
    lower.includes('vessel')
  ) {
    return 'ship';
  }

  // Earthquake
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
 * Extracts CameraData from a CCTV entity/billboard
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
  const bbPick = isBillboardPick(picked);
  if (bbPick) {
    const d = bbPick.data;
    if (d.callsign) return String(d.callsign);
    if (d.name) return String(d.name);
    if (d.icao24) return String(d.icao24);
    if (d.mmsi) return String(d.mmsi);
    return bbPick.type;
  }

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
  const bbPick = isBillboardPick(picked);
  if (bbPick) {
    const d = bbPick.data;
    if (d.icao24) return String(d.icao24);
    if (d.mmsi) return String(d.mmsi);
    if (d.id) return String(d.id);
    if (d.name) return String(d.name);
    return `${bbPick.type}-${Date.now()}`;
  }

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
  cctv: new Cartesian3(0, -150, 80),                // ~170m street-level (default, overridden by directional offset)
};

/**
 * Compass direction to heading angle in degrees (clockwise from North)
 */
const COMPASS_TO_HEADING: Record<string, number> = {
  N: 0, NE: 45, E: 90, SE: 135,
  S: 180, SW: 225, W: 270, NW: 315,
};

/**
 * Calculates a street-level ViewFrom offset based on camera's compass direction.
 * The offset positions the viewer as if they are looking from behind the camera,
 * offset in the direction the camera faces.
 *
 * @param direction - compass direction string (e.g., "N", "SE", "W")
 * @returns Cartesian3 viewFrom offset for street-level cinematic view
 */
function computeCctvViewFromOffset(direction: string): Cartesian3 {
  const headingDeg = COMPASS_TO_HEADING[direction.toUpperCase()];
  if (headingDeg === undefined) {
    // No direction available — default offset (behind and above)
    return new Cartesian3(0, -150, 80);
  }

  // Offset distance from the camera position (meters)
  const distance = 150;
  const elevation = 80; // meters above camera

  // Convert heading to radians. Heading is clockwise from North.
  // In the local ENU frame: x = East, y = North, z = Up
  // We want to offset the viewer BEHIND the camera (opposite to the direction it faces)
  // so the viewer looks in the same direction as the camera.
  const headingRad = CesiumMath.toRadians(headingDeg + 180); // opposite direction
  const offsetX = distance * Math.sin(headingRad); // East component
  const offsetY = distance * Math.cos(headingRad); // North component

  return new Cartesian3(offsetX, offsetY, elevation);
}

/**
 * EntityClickHandler - Handles click detection and camera lock-on.
 *
 * For Cesium Entity picks (satellites): directly uses viewer.trackedEntity.
 * For BillboardCollection picks (aircraft, ships): creates a temporary
 * Cesium Entity with CallbackProperty position for smooth camera tracking.
 *
 * Empty space click and ESC key both unlock tracking.
 */
export default function EntityClickHandler({ onTrackEntity, onCctvClick }: EntityClickHandlerProps) {
  const { viewer } = useCesium();
  const trackingEntityRef = useRef<import('cesium').Entity | null>(null);
  const trackingPositionRef = useRef<Cartesian3>(new Cartesian3());

  /**
   * Removes the temporary tracking entity from the viewer
   */
  const clearTrackingEntity = useCallback(() => {
    if (trackingEntityRef.current && viewer && !viewer.isDestroyed()) {
      try {
        viewer.entities.remove(trackingEntityRef.current);
      } catch {
        // ignore
      }
    }
    trackingEntityRef.current = null;
    trackingManager.clearTracking();
  }, [viewer]);

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
        if (viewer.trackedEntity) {
          viewer.trackedEntity = undefined;
        }
        clearTrackingEntity();
        return;
      }

      // Use the first (highest priority) pick
      const picked = picks[0] as unknown;
      const text = getEntityText(picked);
      const entityType = classifyEntity(text, picked);

      if (!entityType) {
        onTrackEntity(null);
        onCctvClick(null);
        clearTrackingEntity();
        return;
      }

      // Handle CCTV entities — create tracking entity with directional offset
      if (entityType === 'cctv') {
        const cameraData = extractCameraData(picked);
        onCctvClick(cameraData);

        if (cameraData) {
          // Build TrackedEntityInfo for CCTV
          const cctvTrackedInfo: TrackedEntityInfo = {
            type: 'cctv',
            id: cameraData.id,
            name: cameraData.name,
            data: cameraData as unknown as Record<string, unknown>,
          };
          onTrackEntity(cctvTrackedInfo);

          // Remove old tracking entity
          clearTrackingEntity();

          // Create temporary entity at camera coordinates for street-level tracking
          const pos = Cartesian3.fromDegrees(cameraData.lon, cameraData.lat, 10);
          Cartesian3.clone(pos, trackingPositionRef.current);

          const posCallback = new CallbackProperty(() => trackingPositionRef.current, false);

          // Calculate directional ViewFrom offset based on camera compass direction
          const viewFromOffset = computeCctvViewFromOffset(cameraData.direction);

          const trackEntity = viewer.entities.add({
            position: posCallback as unknown as Cartesian3,
            point: { pixelSize: 1, show: false },
            viewFrom: viewFromOffset,
          });

          trackingEntityRef.current = trackEntity;

          // Register with tracking manager
          trackingManager.setTracking(
            trackingPositionRef.current,
            cctvTrackedInfo.id,
            'cctv'
          );

          try {
            viewer.trackedEntity = trackEntity;
          } catch {
            // Entity may not be trackable
          }
        } else {
          onTrackEntity(null);
          if (viewer.trackedEntity) {
            viewer.trackedEntity = undefined;
          }
          clearTrackingEntity();
        }
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
      onCctvClick(null);

      // --- Camera lock-on ---
      const bbPick = isBillboardPick(picked);

      if (bbPick) {
        // Billboard pick (aircraft, ship, earthquake from PointPrimitive) —
        // Create a temporary tracking entity at the picked position
        const d = bbPick.data;
        const lat = Number(d.lat);
        const lon = Number(d.lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          const altMeters = Number(d.altitudeMeters || d.altitude || 0);
          const pos = Cartesian3.fromDegrees(lon, lat, altMeters);

          // Remove old tracking entity
          clearTrackingEntity();

          // Store initial position
          Cartesian3.clone(pos, trackingPositionRef.current);

          // Create temporary entity with CallbackProperty for smooth tracking
          const posCallback = new CallbackProperty(() => trackingPositionRef.current, false);

          const trackEntity = viewer.entities.add({
            position: posCallback as unknown as Cartesian3,
            point: { pixelSize: 1, show: false },
            viewFrom: VIEW_FROM_OFFSETS[entityType],
          });

          trackingEntityRef.current = trackEntity;

          // Register with tracking manager so layers can update position
          trackingManager.setTracking(
            trackingPositionRef.current,
            trackedInfo.id,
            trackedInfo.type
          );

          try {
            viewer.trackedEntity = trackEntity;
          } catch {
            // Entity may not be trackable
          }
        }
      } else {
        // Cesium Entity pick (satellite) — use the entity directly
        const obj = picked as Record<string, unknown>;
        if (obj.id && typeof obj.id === 'object') {
          const cesiumEntity = obj.id as Record<string, unknown>;
          if ('viewFrom' in cesiumEntity) {
            (cesiumEntity as { viewFrom: Cartesian3 }).viewFrom = VIEW_FROM_OFFSETS[entityType];
          }
          clearTrackingEntity();
          try {
            viewer.trackedEntity = cesiumEntity as never;
          } catch {
            // Entity may not be trackable
          }
        }
      }
    },
    [viewer, onTrackEntity, onCctvClick, clearTrackingEntity]
  );

  useEffect(() => {
    if (!viewer) return;

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    // Left click: detect and classify entities
    handler.setInputAction(handleClick, ScreenSpaceEventType.LEFT_CLICK);

    // ESC key handler to unlock tracking
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onTrackEntity(null);
        onCctvClick(null);
        if (viewer.trackedEntity) {
          viewer.trackedEntity = undefined;
        }
        clearTrackingEntity();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      handler.destroy();
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewer, handleClick, onTrackEntity, onCctvClick, clearTrackingEntity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTrackingEntity();
    };
  }, [clearTrackingEntity]);

  return null;
}
