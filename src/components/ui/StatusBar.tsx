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
 * StatusBar - Bottom information bar
 * Desktop: three sections (camera, UTC clock, entity counts).
 * Mobile: compact single row.
 * DMS coordinates, monospace font for data values.
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

  // TODO: Implement DMS coordinate formatting
  // TODO: Implement altitude formatting (m/km)
  // TODO: Implement mobile compact mode

  const formatUtc = (date: Date) => {
    return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-8 bg-black/80 backdrop-blur-md border-t border-white/10 z-50 flex items-center justify-between px-3 text-[10px] font-mono">
      <div className="text-white/60 space-x-3">
        <span>LAT {cameraState.lat.toFixed(4)}</span>
        <span>LON {cameraState.lon.toFixed(4)}</span>
        <span>ALT {(cameraState.altitude / 1000).toFixed(0)}km</span>
        <span>HDG {cameraState.heading.toFixed(0)}&deg;</span>
      </div>
      <div className="text-accent">{formatUtc(utcTime)}</div>
      <div className="flex items-center space-x-3">
        <span className="text-green-400">ACFT {flightCount}</span>
        <span className="text-green-400">SATS {satelliteCount}</span>
        <span className="text-amber-400">SEIS {earthquakeCount}</span>
        <span className="text-red-400">CCTV {cctvCount}</span>
        <span className="text-cyan-400">AIS {shipCount}</span>
        <span className={
          shaderMode === 'CRT' ? 'text-amber-400' :
          shaderMode === 'NVG' ? 'text-green-400' :
          shaderMode === 'FLIR' ? 'text-red-400' :
          'text-white/60'
        }>OPTICS {shaderMode === 'STANDARD' ? 'STD' : shaderMode}</span>
      </div>
    </div>
  );
}
