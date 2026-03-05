import type { CameraData } from '../../types';

interface CCTVPanelProps {
  cameras: CameraData[];
  selectedCamera: CameraData | null;
  onSelectCamera: (camera: CameraData | null) => void;
  onFlyTo: (camera: CameraData) => void;
}

/**
 * CCTVPanel - Side panel for browsing CCTV camera feeds
 * Desktop: fixed 320px right panel, collapsible. Mobile: button badge with modal.
 * Country filter, thumbnail grid, large preview, FLY TO LOCATION.
 */
export default function CCTVPanel({ cameras, selectedCamera, onSelectCamera, onFlyTo }: CCTVPanelProps) {
  // TODO: Implement desktop panel layout (320px right side)
  // TODO: Implement mobile button badge + modal
  // TODO: Implement country/region filter buttons
  // TODO: Implement camera thumbnail grid (3 col desktop, 2 mobile)
  // TODO: Implement selected camera large preview
  // TODO: Implement FLY TO LOCATION button
  // TODO: Implement LOAD MORE pagination (30 camera chunks)
  // TODO: Implement SIGNAL LOST error state
  // TODO: Implement lazy loading on images

  const onlineCameras = cameras.filter((c) => c.available);

  return (
    <div className="fixed right-0 top-[50vh] bottom-8 w-80 bg-black/80 backdrop-blur-md border-l border-white/10 z-50 overflow-y-auto hidden lg:block">
      <div className="p-2 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest">CCTV Feeds</h2>
        <span className="text-[10px] text-green-400">{onlineCameras.length} ONLINE</span>
      </div>
      {/* TODO: Content will be implemented by coding agents */}
    </div>
  );
}
