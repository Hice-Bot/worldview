import { useState, useMemo, useCallback } from 'react';
import type { CameraData } from '../../types';

interface CCTVPanelProps {
  cameras: CameraData[];
  selectedCamera: CameraData | null;
  onSelectCamera: (camera: CameraData | null) => void;
  onFlyTo: (camera: CameraData) => void;
}

const PAGE_SIZE = 30;

// Proxy image URL through our CORS-safe backend
function proxyImageUrl(url: string): string {
  if (!url) return '';
  return `/api/cctv/image?url=${encodeURIComponent(url)}`;
}

// Format DMS coordinates
function formatDMS(decimal: number, isLat: boolean): string {
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minRaw = (abs - deg) * 60;
  const min = Math.floor(minRaw);
  const sec = Math.round((minRaw - min) * 60);
  const dir = isLat ? (decimal >= 0 ? 'N' : 'S') : (decimal >= 0 ? 'E' : 'W');
  return `${deg}\u00B0${min}'${sec}" ${dir}`;
}

/**
 * CCTVPanel - Side panel for browsing CCTV camera feeds
 * Desktop: fixed 320px right panel, collapsible. Mobile: button badge with modal.
 * Country filter, thumbnail grid, large preview, FLY TO LOCATION.
 */
export default function CCTVPanel({ cameras, selectedCamera, onSelectCamera, onFlyTo }: CCTVPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Online camera count
  const onlineCameras = useMemo(() => cameras.filter((c) => c.available), [cameras]);

  // Apply country filter
  const filteredCameras = useMemo(() => {
    if (!countryFilter) return cameras;
    return cameras.filter((c) => c.country === countryFilter);
  }, [cameras, countryFilter]);

  // Paginated cameras
  const visibleCameras = useMemo(
    () => filteredCameras.slice(0, visibleCount),
    [filteredCameras, visibleCount]
  );

  // Get unique countries for filter buttons
  const countries = useMemo(() => {
    const set = new Set<string>();
    cameras.forEach((c) => { if (c.country) set.add(c.country); });
    return Array.from(set).sort();
  }, [cameras]);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => prev + PAGE_SIZE);
  }, []);

  // Handle FLY TO
  const handleFlyTo = useCallback((cam: CameraData) => {
    onFlyTo(cam);
    // Mobile: auto-minimize after flight
    setMobileOpen(false);
  }, [onFlyTo]);

  // Handle country filter change
  const handleCountryFilter = useCallback((country: string | null) => {
    setCountryFilter(country);
    setVisibleCount(PAGE_SIZE); // Reset pagination
  }, []);

  const hasMore = visibleCount < filteredCameras.length;

  // --- Panel Content (shared between desktop and mobile) ---
  const panelContent = (
    <>
      {/* Header */}
      <div
        className="p-2 border-b border-white/10 flex items-center justify-between cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest">CCTV Feeds</h2>
          <span className="text-[10px] text-green-400 font-mono">{onlineCameras.length} ONLINE</span>
        </div>
        <span className="text-white/40 text-xs">{collapsed ? '▶' : '▼'}</span>
      </div>

      {!collapsed && (
        <div className="flex flex-col overflow-y-auto" style={{ maxHeight: 'calc(100% - 36px)' }}>
          {/* Country/region filter buttons */}
          <div className="p-2 flex flex-wrap gap-1 border-b border-white/10">
            <button
              className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded transition-colors ${
                countryFilter === null
                  ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                  : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
              }`}
              onClick={() => handleCountryFilter(null)}
            >
              ALL ({cameras.length})
            </button>
            {countries.map((country) => {
              const count = cameras.filter((c) => c.country === country).length;
              const colorClass = country === 'GB' ? 'text-cyan-300 border-cyan-500/50 bg-cyan-500/30'
                : country === 'US' ? 'text-amber-300 border-amber-500/50 bg-amber-500/30'
                : country === 'AU' ? 'text-green-300 border-green-500/50 bg-green-500/30'
                : 'text-gray-300 border-gray-500/50 bg-gray-500/30';
              const inactiveClass = 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10';
              return (
                <button
                  key={country}
                  className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded transition-colors ${
                    countryFilter === country ? colorClass + ' border' : inactiveClass
                  }`}
                  onClick={() => handleCountryFilter(country)}
                >
                  {country} ({count})
                </button>
              );
            })}
          </div>

          {/* Selected camera large preview */}
          {selectedCamera && (
            <div className="p-2 border-b border-white/10 bg-white/5">
              <div className="relative w-full aspect-video bg-black rounded overflow-hidden mb-2">
                {selectedCamera.imageUrl ? (
                  <img
                    src={proxyImageUrl(selectedCamera.imageUrl)}
                    alt={selectedCamera.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const sibling = target.nextElementSibling as HTMLElement;
                      if (sibling) sibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  className="absolute inset-0 items-center justify-center bg-black/80 text-red-500 font-mono text-xs uppercase"
                  style={{ display: selectedCamera.imageUrl ? 'none' : 'flex' }}
                >
                  ⚠ SIGNAL LOST
                </div>
              </div>
              <div className="text-[10px] text-white/80 font-mono mb-1 truncate">
                {selectedCamera.name}
              </div>
              <div className="text-[9px] text-white/40 font-mono mb-2">
                {formatDMS(selectedCamera.lat, true)} | {formatDMS(selectedCamera.lon, false)}
                {selectedCamera.region ? ` | ${selectedCamera.region}` : ''}
              </div>
              <button
                className="w-full py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 text-cyan-300 text-[10px] font-bold uppercase tracking-wider rounded transition-colors"
                onClick={() => handleFlyTo(selectedCamera)}
              >
                ◎ FLY TO LOCATION
              </button>
              <button
                className="w-full mt-1 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 text-[10px] uppercase rounded transition-colors"
                onClick={() => onSelectCamera(null)}
              >
                DESELECT
              </button>
            </div>
          )}

          {/* Thumbnail grid */}
          <div className="p-2">
            <div className="grid grid-cols-3 lg:grid-cols-3 gap-1">
              {visibleCameras.map((cam) => (
                <CameraThumbnail
                  key={cam.id}
                  camera={cam}
                  isSelected={selectedCamera?.id === cam.id}
                  onClick={() => onSelectCamera(cam)}
                />
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <button
                className="w-full mt-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 text-[10px] font-bold uppercase tracking-wider rounded transition-colors"
                onClick={handleLoadMore}
              >
                LOAD MORE ({filteredCameras.length - visibleCount} remaining)
              </button>
            )}

            {filteredCameras.length === 0 && (
              <div className="text-center text-white/30 text-xs py-4 font-mono uppercase">
                No cameras available
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop panel: fixed 320px right-side panel, below IntelFeed */}
      <div className="fixed right-0 top-[50vh] bottom-8 w-80 bg-black/80 backdrop-blur-md border-l border-white/10 z-50 overflow-hidden hidden lg:flex lg:flex-col pointer-events-auto">
        {panelContent}
      </div>

      {/* Mobile: badge button + full-screen modal */}
      <button
        className="fixed right-4 bottom-12 z-50 w-10 h-10 rounded-full bg-black/80 backdrop-blur-md border border-white/20 flex items-center justify-center lg:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <span className="text-white/80 text-sm">📹</span>
        {onlineCameras.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {onlineCameras.length > 99 ? '99+' : onlineCameras.length}
          </span>
        )}
      </button>

      {/* Mobile modal */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex flex-col lg:hidden">
          <div className="flex items-center justify-between p-3 border-b border-white/10">
            <h2 className="text-sm font-bold text-white/80 uppercase tracking-widest">CCTV Feeds</h2>
            <button
              className="text-white/60 hover:text-white text-lg"
              onClick={() => setMobileOpen(false)}
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* Country filters */}
            <div className="p-2 flex flex-wrap gap-1 border-b border-white/10">
              <button
                className={`px-3 py-1 text-xs uppercase font-bold rounded ${
                  countryFilter === null
                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                    : 'bg-white/5 text-white/50 border border-white/10'
                }`}
                onClick={() => handleCountryFilter(null)}
              >
                ALL ({cameras.length})
              </button>
              {countries.map((country) => {
                const count = cameras.filter((c) => c.country === country).length;
                return (
                  <button
                    key={country}
                    className={`px-3 py-1 text-xs uppercase font-bold rounded ${
                      countryFilter === country
                        ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                        : 'bg-white/5 text-white/50 border border-white/10'
                    }`}
                    onClick={() => handleCountryFilter(country)}
                  >
                    {country} ({count})
                  </button>
                );
              })}
            </div>

            {/* Selected camera preview */}
            {selectedCamera && (
              <div className="p-3 border-b border-white/10 bg-white/5">
                <div className="relative w-full aspect-video bg-black rounded overflow-hidden mb-2">
                  {selectedCamera.imageUrl ? (
                    <img
                      src={proxyImageUrl(selectedCamera.imageUrl)}
                      alt={selectedCamera.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const sibling = target.nextElementSibling as HTMLElement;
                        if (sibling) sibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className="absolute inset-0 items-center justify-center bg-black/80 text-red-500 font-mono text-sm uppercase"
                    style={{ display: selectedCamera.imageUrl ? 'none' : 'flex' }}
                  >
                    ⚠ SIGNAL LOST
                  </div>
                </div>
                <div className="text-xs text-white/80 font-mono mb-1">{selectedCamera.name}</div>
                <div className="text-[10px] text-white/40 font-mono mb-2">
                  {formatDMS(selectedCamera.lat, true)} | {formatDMS(selectedCamera.lon, false)}
                </div>
                <button
                  className="w-full py-2 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 text-cyan-300 text-xs font-bold uppercase tracking-wider rounded"
                  onClick={() => handleFlyTo(selectedCamera)}
                >
                  ◎ FLY TO LOCATION
                </button>
              </div>
            )}

            {/* Mobile thumbnail grid: 2 columns */}
            <div className="p-2">
              <div className="grid grid-cols-2 gap-1.5">
                {visibleCameras.map((cam) => (
                  <CameraThumbnail
                    key={cam.id}
                    camera={cam}
                    isSelected={selectedCamera?.id === cam.id}
                    onClick={() => onSelectCamera(cam)}
                  />
                ))}
              </div>

              {hasMore && (
                <button
                  className="w-full mt-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 text-xs font-bold uppercase tracking-wider rounded"
                  onClick={handleLoadMore}
                >
                  LOAD MORE ({filteredCameras.length - visibleCount} remaining)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// --- Camera Thumbnail Component ---
function CameraThumbnail({
  camera,
  isSelected,
  onClick,
}: {
  camera: CameraData;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`relative cursor-pointer rounded overflow-hidden transition-all ${
        isSelected
          ? 'ring-1 ring-red-500 scale-[1.02]'
          : 'ring-1 ring-transparent hover:ring-white/30'
      }`}
      onClick={onClick}
    >
      <div className="relative aspect-video bg-black/60">
        {camera.imageUrl ? (
          <img
            src={proxyImageUrl(camera.imageUrl)}
            alt={camera.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                const errDiv = parent.querySelector('.signal-lost') as HTMLElement;
                if (errDiv) errDiv.style.display = 'flex';
              }
            }}
          />
        ) : null}
        <div
          className="signal-lost absolute inset-0 items-center justify-center bg-black/80 text-red-500/70 font-mono text-[8px] uppercase"
          style={{ display: camera.imageUrl ? 'none' : 'flex' }}
        >
          SIGNAL LOST
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-1 py-0.5">
        <div className="text-[8px] text-white/70 font-mono truncate">
          {camera.name}
        </div>
      </div>
      {/* Available indicator */}
      <div
        className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${
          camera.available ? 'bg-green-400' : 'bg-red-500'
        }`}
      />
    </div>
  );
}
