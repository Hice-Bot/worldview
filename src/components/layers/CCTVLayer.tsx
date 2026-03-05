import { useEffect, useRef } from 'react';
import { useCesium } from 'resium';
import type { CameraData } from '../../types';

interface CCTVLayerProps {
  cameras: CameraData[];
  selectedCamera: CameraData | null;
}

/**
 * CCTVLayer - CCTV camera locations on globe
 * BillboardCollection for camera icons + LabelCollection for names.
 * Country color coding, distance-based scaling, lock-on with directional offset.
 */
export default function CCTVLayer({ cameras, selectedCamera }: CCTVLayerProps) {
  const { viewer } = useCesium();
  const billboardCollectionRef = useRef<unknown>(null);
  const labelCollectionRef = useRef<unknown>(null);

  useEffect(() => {
    if (!viewer) return;

    // TODO: Create BillboardCollection and LabelCollection
    // TODO: Canvas-drawn camera icons
    // TODO: Country color coding (GB=cyan, US=amber, AU=green)
    // TODO: Distance-based scaling and translucency
    // TODO: Selected camera highlighting (red, 1.5x)
    // TODO: CCTV lock-on with directional offset

    return () => {
      // Cleanup primitive collections
    };
  }, [viewer, cameras, selectedCamera]);

  return null;
}
