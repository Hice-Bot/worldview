import { useEffect } from 'react';
import { useCesium } from 'resium';
import type { TrackedEntityInfo, CameraData } from '../../types';

interface EntityClickHandlerProps {
  onTrackEntity: (entity: TrackedEntityInfo | null) => void;
  onCctvClick: (camera: CameraData | null) => void;
}

/**
 * EntityClickHandler - Handles click detection and camera lock-on
 * Uses Cesium scene.drillPick to detect clicked entities,
 * classifies them by type via keyword inspection, and
 * triggers camera lock-on with type-specific viewFrom offsets.
 */
export default function EntityClickHandler({ onTrackEntity, onCctvClick }: EntityClickHandlerProps) {
  const { viewer } = useCesium();

  useEffect(() => {
    if (!viewer) return;

    // TODO: Implement drillPick click handler
    // TODO: Implement entity type classification
    // TODO: Implement camera lock-on with type-specific viewFrom offsets
    // TODO: Implement ESC key to unlock
    // TODO: Implement empty-space click to unlock

    return () => {
      // Cleanup event listeners
    };
  }, [viewer, onTrackEntity, onCctvClick]);

  return null;
}
