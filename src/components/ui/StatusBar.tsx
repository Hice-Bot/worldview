import { useState, useEffect } from 'react';
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

  useEffect(() => {
    const interval = setInterval(() => setUtcTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatUtc = (date: Date) => {
    return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  };

  const shaderLabel = shaderMode === 'STANDARD' ? 'STD' : shaderMode;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between font-mono"
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
      <div className="flex items-center" style={{ gap: '10px' }}>
        <span style={{ color: 'rgba(0, 255, 200, 0.7)' }}>
          LAT <span style={{ color: 'rgba(0, 255, 200, 0.9)' }}>{toDMS(cameraState.lat, true)}</span>
        </span>
        <span style={{ color: 'rgba(0, 255, 200, 0.7)' }}>
          LON <span style={{ color: 'rgba(0, 255, 200, 0.9)' }}>{toDMS(cameraState.lon, false)}</span>
        </span>
        <span style={{ color: 'rgba(0, 255, 200, 0.7)' }}>
          ALT <span style={{ color: 'rgba(0, 255, 200, 0.9)' }}>{formatAltitude(cameraState.altitude)}</span>
        </span>
        <span style={{ color: 'rgba(0, 255, 200, 0.7)' }}>
          HDG <span style={{ color: 'rgba(0, 255, 200, 0.9)' }}>{cameraState.heading.toFixed(0)}&deg;</span>
        </span>
      </div>

      {/* Center Section: UTC Clock */}
      <div
        style={{
          color: '#00ffc8',
          textShadow: '0 0 6px rgba(0, 255, 200, 0.4)',
          letterSpacing: '0.5px',
        }}
      >
        {formatUtc(utcTime)}
      </div>

      {/* Right Section: Entity Counts + Optics */}
      <div className="flex items-center" style={{ gap: '10px' }}>
        <span style={{ color: '#4ade80', textShadow: '0 0 4px rgba(74, 222, 128, 0.3)' }}>
          ACFT <span style={{ fontWeight: 600 }}>{flightCount.toLocaleString()}</span>
        </span>
        <span style={{ color: '#4ade80', textShadow: '0 0 4px rgba(74, 222, 128, 0.3)' }}>
          SATS <span style={{ fontWeight: 600 }}>{satelliteCount.toLocaleString()}</span>
        </span>
        <span style={{ color: '#fbbf24', textShadow: '0 0 4px rgba(251, 191, 36, 0.3)' }}>
          SEIS <span style={{ fontWeight: 600 }}>{earthquakeCount}</span>
        </span>
        <span style={{ color: '#f87171', textShadow: '0 0 4px rgba(248, 113, 113, 0.3)' }}>
          CCTV <span style={{ fontWeight: 600 }}>{cctvCount.toLocaleString()}</span>
        </span>
        <span style={{ color: '#22d3ee', textShadow: '0 0 4px rgba(34, 211, 238, 0.3)' }}>
          AIS <span style={{ fontWeight: 600 }}>{shipCount.toLocaleString()}</span>
        </span>
        <span
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
      </div>
    </div>
  );
}
