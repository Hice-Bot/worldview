import { useState, useEffect, useRef } from 'react';
import type { CameraState, ShaderMode } from '../../types';

interface StatusBarProps {
  cameraState: CameraState;
  shaderMode: ShaderMode;
  flightCount: number;
  satelliteCount: number;
  earthquakeCount: number;
  cctvCount: number;
  shipCount: number;
}

/**
 * Convert decimal degrees to DMS (Degrees, Minutes, Seconds) format
 * with hemisphere indicator (N/S for latitude, E/W for longitude)
 */
function toDMS(decimal: number, isLat: boolean): string {
  const hemisphere = isLat
    ? (decimal >= 0 ? 'N' : 'S')
    : (decimal >= 0 ? 'E' : 'W');
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(1);
  return `${deg}\u00B0${min.toString().padStart(2, '0')}'${sec.toString().padStart(4, '0')}"${hemisphere}`;
}

/**
 * Abbreviated DMS for mobile: just degrees and minutes with hemisphere
 */
function toDMSShort(decimal: number, isLat: boolean): string {
  const hemisphere = isLat
    ? (decimal >= 0 ? 'N' : 'S')
    : (decimal >= 0 ? 'E' : 'W');
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  return `${deg}\u00B0${min}'${hemisphere}`;
}

/**
 * Format altitude: meters below 1km, km above 1km
 */
function formatAltitude(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * StatusBar - Bottom information bar
 * Desktop: three sections (camera position, UTC clock, entity counts).
 * DMS coordinates, monospace font for data values.
 * Glass-morphism styling with cyan/green tactical glows.
 */
export default function StatusBar({
  cameraState,
  shaderMode,
  flightCount,
  satelliteCount,
  earthquakeCount,
  cctvCount,
  shipCount,
}: StatusBarProps) {
  const [utcTime, setUtcTime] = useState(new Date());
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());
  const rafIdRef = useRef<number>(0);

  useEffect(() => {
    const interval = setInterval(() => setUtcTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // FPS counter: counts requestAnimationFrame callbacks, updates display every 500ms
  useEffect(() => {
    let cancelled = false;

    const measureFps = (now: number) => {
      if (cancelled) return;
      frameCountRef.current++;
      const elapsed = now - lastFpsTimeRef.current;
      if (elapsed >= 500) {
        const currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
        setFps(currentFps);
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }
      rafIdRef.current = requestAnimationFrame(measureFps);
    };

    rafIdRef.current = requestAnimationFrame(measureFps);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const formatUtc = (date: Date) => {
    return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  };

  const shaderLabel = shaderMode === 'STANDARD' ? 'STD' : shaderMode;

  // Compact UTC format for mobile: HH:MM:SS UTC
  const formatUtcCompact = (date: Date) => {
    return date.toISOString().slice(11, 19) + 'Z';
  };

  return (
    <>
      {/* Desktop StatusBar (>= 1024px) */}
      <footer
        role="status"
        aria-label="Status bar"
        className="fixed bottom-0 left-0 lg:left-56 right-0 z-50 hidden lg:flex items-center justify-between font-mono pointer-events-auto"
        style={{
          height: '32px',
          backgroundColor: 'rgba(0, 10, 15, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(0, 255, 200, 0.15)',
          boxShadow: '0 -1px 8px rgba(0, 255, 200, 0.06), inset 0 1px 0 rgba(0, 255, 200, 0.05)',
          paddingLeft: '12px',
          paddingRight: '12px',
          fontSize: '10px',
        }}
      >
        {/* Left Section: Camera Position */}
        <div className="flex items-center" style={{ gap: '10px' }} aria-label="Camera position" role="group">
          <span style={{ color: 'rgba(0, 255, 200, 0.7)' }} aria-label={`Latitude ${toDMS(cameraState.lat, true)}`}>
            LAT <span style={{ color: 'rgba(0, 255, 200, 0.9)' }}>{toDMS(cameraState.lat, true)}</span>
          </span>
          <span style={{ color: 'rgba(0, 255, 200, 0.7)' }} aria-label={`Longitude ${toDMS(cameraState.lon, false)}`}>
            LON <span style={{ color: 'rgba(0, 255, 200, 0.9)' }}>{toDMS(cameraState.lon, false)}</span>
          </span>
          <span style={{ color: 'rgba(0, 255, 200, 0.7)' }} aria-label={`Altitude ${formatAltitude(cameraState.altitude)}`}>
            ALT <span style={{ color: 'rgba(0, 255, 200, 0.9)' }}>{formatAltitude(cameraState.altitude)}</span>
          </span>
          <span style={{ color: 'rgba(0, 255, 200, 0.7)' }} aria-label={`Heading ${cameraState.heading.toFixed(0)} degrees`}>
            HDG <span style={{ color: 'rgba(0, 255, 200, 0.9)' }}>{cameraState.heading.toFixed(0)}&deg;</span>
          </span>
        </div>

        {/* Center Section: UTC Clock */}
        <time
          aria-label={`UTC time: ${formatUtc(utcTime)}`}
          aria-live="off"
          dateTime={utcTime.toISOString()}
          style={{
            color: '#00ffc8',
            textShadow: '0 0 6px rgba(0, 255, 200, 0.4)',
            letterSpacing: '0.5px',
          }}
        >
          {formatUtc(utcTime)}
        </time>

        {/* Right Section: Entity Counts + Optics */}
        <div className="flex items-center" style={{ gap: '10px' }} aria-live="polite" aria-label="Entity counts" role="group">
          <span style={{ color: '#4ade80', textShadow: '0 0 4px rgba(74, 222, 128, 0.3)' }} aria-label={`${flightCount.toLocaleString()} aircraft tracked`}>
            ACFT <span style={{ fontWeight: 600 }}>{flightCount.toLocaleString()}</span>
          </span>
          <span style={{ color: '#4ade80', textShadow: '0 0 4px rgba(74, 222, 128, 0.3)' }} aria-label={`${satelliteCount.toLocaleString()} satellites tracked`}>
            SATS <span style={{ fontWeight: 600 }}>{satelliteCount.toLocaleString()}</span>
          </span>
          <span style={{ color: '#fbbf24', textShadow: '0 0 4px rgba(251, 191, 36, 0.3)' }} aria-label={`${earthquakeCount} seismic events`}>
            SEIS <span style={{ fontWeight: 600 }}>{earthquakeCount}</span>
          </span>
          <span style={{ color: '#f87171', textShadow: '0 0 4px rgba(248, 113, 113, 0.3)' }} aria-label={`${cctvCount.toLocaleString()} CCTV cameras`}>
            CCTV <span style={{ fontWeight: 600 }}>{cctvCount.toLocaleString()}</span>
          </span>
          <span style={{ color: '#22d3ee', textShadow: '0 0 4px rgba(34, 211, 238, 0.3)' }} aria-label={`${shipCount.toLocaleString()} AIS ships tracked`}>
            AIS <span style={{ fontWeight: 600 }}>{shipCount.toLocaleString()}</span>
          </span>
          <span
            aria-label={`Optics mode: ${shaderMode}`}
            style={{
              color: shaderMode === 'CRT' ? '#fbbf24' :
                     shaderMode === 'NVG' ? '#4ade80' :
                     shaderMode === 'FLIR' ? '#f87171' :
                     'rgba(255, 255, 255, 0.5)',
              textShadow: shaderMode !== 'STANDARD'
                ? `0 0 4px ${shaderMode === 'CRT' ? 'rgba(251, 191, 36, 0.3)' : shaderMode === 'NVG' ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`
                : 'none',
              borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
              paddingLeft: '10px',
            }}
          >
            OPTICS {shaderLabel}
          </span>
          <span
            aria-label={`${fps} frames per second`}
            style={{
              color: fps >= 30 ? '#4ade80' : fps >= 15 ? '#fbbf24' : '#f87171',
              textShadow: `0 0 4px ${fps >= 30 ? 'rgba(74, 222, 128, 0.3)' : fps >= 15 ? 'rgba(251, 191, 36, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
              borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
              paddingLeft: '10px',
            }}
          >
            FPS <span style={{ fontWeight: 600 }}>{fps}</span>
          </span>
        </div>
      </footer>

      {/* Mobile StatusBar (< 1024px) - Compact single row, 28px height */}
      <footer
        role="status"
        aria-label="Status bar"
        className="fixed bottom-0 left-0 right-0 z-50 flex lg:hidden items-center justify-between font-mono pointer-events-auto"
        data-testid="mobile-statusbar"
        style={{
          height: '28px',
          backgroundColor: 'rgba(0, 10, 15, 0.9)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(0, 255, 200, 0.15)',
          boxShadow: '0 -1px 8px rgba(0, 255, 200, 0.06)',
          paddingLeft: '8px',
          paddingRight: '8px',
          fontSize: '9px',
        }}
      >
        {/* Left: Abbreviated coords + altitude */}
        <div className="flex items-center" style={{ gap: '6px' }} aria-label="Camera position">
          <span style={{ color: 'rgba(0, 255, 200, 0.9)' }} aria-label={`Position: ${toDMSShort(cameraState.lat, true)} ${toDMSShort(cameraState.lon, false)}`}>
            {toDMSShort(cameraState.lat, true)} {toDMSShort(cameraState.lon, false)}
          </span>
          <span style={{ color: 'rgba(0, 255, 200, 0.7)' }} aria-label={`Altitude ${formatAltitude(cameraState.altitude)}`}>
            {formatAltitude(cameraState.altitude)}
          </span>
        </div>

        {/* Center: Compact UTC time */}
        <time
          aria-label={`UTC time: ${formatUtcCompact(utcTime)}`}
          dateTime={utcTime.toISOString()}
          style={{
            color: '#00ffc8',
            textShadow: '0 0 4px rgba(0, 255, 200, 0.3)',
            letterSpacing: '0.3px',
          }}
        >
          {formatUtcCompact(utcTime)}
        </time>

        {/* Right: Key entity counts only (abbreviated) */}
        <div className="flex items-center" style={{ gap: '5px' }} aria-live="polite" aria-label="Entity counts">
          <span style={{ color: '#4ade80' }} aria-label={`${flightCount.toLocaleString()} aircraft`}>
            <span style={{ fontWeight: 600 }}>{flightCount.toLocaleString()}</span>
          </span>
          <span style={{ color: '#fbbf24' }} aria-label={`${earthquakeCount} seismic events`}>
            <span style={{ fontWeight: 600 }}>{earthquakeCount}</span>
          </span>
          <span style={{ color: '#22d3ee' }} aria-label={`${shipCount.toLocaleString()} ships`}>
            <span style={{ fontWeight: 600 }}>{shipCount.toLocaleString()}</span>
          </span>
          <span
            aria-label={`${fps} frames per second`}
            style={{
              color: fps >= 30 ? '#4ade80' : fps >= 15 ? '#fbbf24' : '#f87171',
              borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
              paddingLeft: '5px',
            }}
          >
            {fps}
          </span>
        </div>
      </footer>
    </>
  );
}
