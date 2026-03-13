import { useEffect, useRef, useCallback } from 'react';
import { useCesium } from 'resium';
import {
  Cartesian2,
  Cartesian3,
  Color,
  BillboardCollection,
  LabelCollection,
  LabelStyle,
  VerticalOrigin,
  HorizontalOrigin,
  Billboard,
  Label,
} from 'cesium';
import type { CameraData } from '../../types';
import { updateOccluderCamera, isOccluded as checkOccluded } from '../../occlusion';

interface CCTVLayerProps {
  cameras: CameraData[];
  selectedCamera: CameraData | null;
}

// --- Country color coding ---
// GB = cyan (#00D4FF), US = amber (#FF9500), AU = green (#39FF14), default = gray
const COLOR_GB = Color.fromCssColorString('#00D4FF');
const COLOR_US = Color.fromCssColorString('#FF9500');
const COLOR_AU = Color.fromCssColorString('#39FF14');
const COLOR_DEFAULT = Color.GRAY;
const COLOR_SELECTED = Color.fromCssColorString('#FF3B30');

function getCountryColor(country: string): Color {
  switch (country?.toUpperCase()) {
    case 'GB': return COLOR_GB;
    case 'US': return COLOR_US;
    case 'AU': return COLOR_AU;
    default: return COLOR_DEFAULT;
  }
}

// --- Canvas-drawn camera icon ---
// Rounded rectangular body + triangular lens + red recording dot
let cachedIconDataUrl: string | null = null;
function getCameraIconUrl(): string {
  if (cachedIconDataUrl) return cachedIconDataUrl;

  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, size, size);

  // Camera body - rounded rectangle
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;

  // Body (rounded rect)
  const bodyX = 4;
  const bodyY = 10;
  const bodyW = 20;
  const bodyH = 14;
  const radius = 3;
  ctx.beginPath();
  ctx.moveTo(bodyX + radius, bodyY);
  ctx.lineTo(bodyX + bodyW - radius, bodyY);
  ctx.arcTo(bodyX + bodyW, bodyY, bodyX + bodyW, bodyY + radius, radius);
  ctx.lineTo(bodyX + bodyW, bodyY + bodyH - radius);
  ctx.arcTo(bodyX + bodyW, bodyY + bodyH, bodyX + bodyW - radius, bodyY + bodyH, radius);
  ctx.lineTo(bodyX + radius, bodyY + bodyH);
  ctx.arcTo(bodyX, bodyY + bodyH, bodyX, bodyY + bodyH - radius, radius);
  ctx.lineTo(bodyX, bodyY + radius);
  ctx.arcTo(bodyX, bodyY, bodyX + radius, bodyY, radius);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Triangular lens (pointing right)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(24, 13);
  ctx.lineTo(30, 17);
  ctx.lineTo(24, 21);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Red recording dot (top-right)
  ctx.fillStyle = '#FF0000';
  ctx.beginPath();
  ctx.arc(22, 8, 3, 0, Math.PI * 2);
  ctx.fill();

  // Inner lens circle on body
  ctx.fillStyle = '#333333';
  ctx.beginPath();
  ctx.arc(14, 17, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Inner lens highlight
  ctx.fillStyle = '#555555';
  ctx.beginPath();
  ctx.arc(14, 17, 3, 0, Math.PI * 2);
  ctx.fill();

  cachedIconDataUrl = canvas.toDataURL('image/png');
  return cachedIconDataUrl;
}

// Track per-camera billboard/label state
interface CameraEntry {
  billboard: Billboard;
  label: Label;
  camera: CameraData;
  position: Cartesian3;
}

// (Scratch vectors for occlusion removed — now using shared EllipsoidalOccluder)

/**
 * CCTVLayer - Renders CCTV camera locations on the globe using imperative
 * BillboardCollection + LabelCollection.
 *
 * Country color coding: GB=cyan, US=amber, AU=green, default=gray
 * Selected camera: red (#FF3B30) at 1.5x scale, depth test disabled
 * Distance-based scaling: 1.2x at 5km to 0.4x at 500km
 * Label opacity fades beyond 50km
 * Translucency: 1.0 at 1km to 0.3 at 2000km
 */
export default function CCTVLayer({ cameras, selectedCamera }: CCTVLayerProps) {
  const { viewer } = useCesium();
  const billboardCollectionRef = useRef<BillboardCollection | null>(null);
  const labelCollectionRef = useRef<LabelCollection | null>(null);
  const cameraMapRef = useRef<Map<string, CameraEntry>>(new Map());
  const initRef = useRef(false);
  const preRenderRef = useRef<(() => void) | null>(null);

  // Create collections once when viewer is available
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || initRef.current) return;

    const bbCollection = new BillboardCollection({ scene: viewer.scene });
    const lblCollection = new LabelCollection({ scene: viewer.scene });

    viewer.scene.primitives.add(bbCollection);
    viewer.scene.primitives.add(lblCollection);

    billboardCollectionRef.current = bbCollection;
    labelCollectionRef.current = lblCollection;
    initRef.current = true;

    return () => {
      if (viewer && !viewer.isDestroyed()) {
        if (billboardCollectionRef.current) {
          viewer.scene.primitives.remove(billboardCollectionRef.current);
        }
        if (labelCollectionRef.current) {
          viewer.scene.primitives.remove(labelCollectionRef.current);
        }
      }
      billboardCollectionRef.current = null;
      labelCollectionRef.current = null;
      cameraMapRef.current.clear();
      initRef.current = false;
    };
  }, [viewer]);

  // Occlusion check: is position on the far side of the globe?
  // Uses EllipsoidalOccluder for accurate horizon culling
  const isOccluded = useCallback((position: Cartesian3): boolean => {
    if (!viewer) return false;
    updateOccluderCamera(viewer.camera.positionWC);
    return checkOccluded(position);
  }, [viewer]);

  // Distance-based scaling: 1.2x at 5km to 0.4x at 500km
  const getDistanceScale = useCallback((distanceMeters: number): number => {
    const minDist = 5000;     // 5km
    const maxDist = 500000;   // 500km
    const minScale = 0.4;
    const maxScale = 1.2;
    if (distanceMeters <= minDist) return maxScale;
    if (distanceMeters >= maxDist) return minScale;
    const t = (distanceMeters - minDist) / (maxDist - minDist);
    return maxScale - t * (maxScale - minScale);
  }, []);

  // Translucency: 1.0 at 1km to 0.3 at 2000km
  const getTranslucency = useCallback((distanceMeters: number): number => {
    const minDist = 1000;      // 1km
    const maxDist = 2000000;   // 2000km
    const minAlpha = 0.3;
    const maxAlpha = 1.0;
    if (distanceMeters <= minDist) return maxAlpha;
    if (distanceMeters >= maxDist) return minAlpha;
    const t = (distanceMeters - minDist) / (maxDist - minDist);
    return maxAlpha - t * (maxAlpha - minAlpha);
  }, []);

  // Label opacity fades beyond 50km
  const getLabelOpacity = useCallback((distanceMeters: number): number => {
    const startFade = 50000;   // 50km
    const endFade = 200000;    // 200km (fully faded)
    if (distanceMeters <= startFade) return 1.0;
    if (distanceMeters >= endFade) return 0.0;
    return 1.0 - (distanceMeters - startFade) / (endFade - startFade);
  }, []);

  // Update billboards/labels when camera data changes
  useEffect(() => {
    const bbCollection = billboardCollectionRef.current;
    const lblCollection = labelCollectionRef.current;
    if (!bbCollection || !lblCollection || !viewer || viewer.isDestroyed()) return;

    const iconUrl = getCameraIconUrl();
    if (!iconUrl) return;

    const existingMap = cameraMapRef.current;
    const currentIds = new Set<string>();

    // Get camera (viewer camera) position for distance calculations
    const viewerCameraPos = viewer.camera.positionWC;
    const cameraAlt = viewer.camera.positionCartographic?.height || 20000000;
    const showLabels = cameraAlt < 500000; // Show labels when zoomed in

    for (const cam of cameras) {
      if (!cam.id || cam.lat === undefined || cam.lon === undefined) continue;
      if (!isFinite(cam.lat) || !isFinite(cam.lon)) continue;

      currentIds.add(cam.id);
      const position = Cartesian3.fromDegrees(cam.lon, cam.lat, 10); // Slight elevation above ground
      const occluded = isOccluded(position);

      // Calculate distance from viewer camera to this CCTV camera
      const distance = Cartesian3.distance(viewerCameraPos, position);
      const scale = getDistanceScale(distance);
      const translucency = getTranslucency(distance);
      const labelOpacity = getLabelOpacity(distance);

      // Selected camera: red, 1.5x scale, depth test disabled
      const isSelected = selectedCamera?.id === cam.id;
      const color = isSelected ? COLOR_SELECTED : getCountryColor(cam.country);
      const finalScale = isSelected ? scale * 1.5 : scale;
      const finalColor = color.withAlpha(translucency);

      const labelText = cam.name || cam.id;

      const existing = existingMap.get(cam.id);
      if (existing) {
        // Update existing billboard
        existing.billboard.position = position;
        existing.billboard.color = finalColor;
        existing.billboard.scale = finalScale;
        existing.billboard.show = !occluded;
        existing.billboard.id = { type: 'cctv', data: cam };
        existing.billboard.disableDepthTestDistance = isSelected ? Number.POSITIVE_INFINITY : 0;

        // Update label
        existing.label.position = position;
        existing.label.text = labelText;
        existing.label.show = !occluded && showLabels && labelOpacity > 0.05;
        existing.label.fillColor = finalColor.withAlpha(labelOpacity * translucency);

        existing.camera = cam;
        existing.position = position;
      } else {
        // Add new billboard
        const bb = bbCollection.add({
          position,
          image: iconUrl,
          scale: finalScale,
          color: finalColor,
          verticalOrigin: VerticalOrigin.CENTER,
          horizontalOrigin: HorizontalOrigin.CENTER,
          show: !occluded,
          id: { type: 'cctv', data: cam },
          disableDepthTestDistance: isSelected ? Number.POSITIVE_INFINITY : 0,
        });

        // Add label
        const lbl = lblCollection.add({
          position,
          text: labelText,
          font: '10px monospace',
          fillColor: finalColor.withAlpha(labelOpacity * translucency),
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          horizontalOrigin: HorizontalOrigin.LEFT,
          pixelOffset: new Cartesian2(12, -4),
          scale: 0.85,
          show: !occluded && showLabels && labelOpacity > 0.05,
          showBackground: true,
          backgroundColor: Color.BLACK.withAlpha(0.5),
        });

        existingMap.set(cam.id, {
          billboard: bb,
          label: lbl,
          camera: cam,
          position,
        });
      }
    }

    // Remove cameras no longer in the data
    const toRemove: string[] = [];
    existingMap.forEach((_entry, id) => {
      if (!currentIds.has(id)) {
        toRemove.push(id);
      }
    });
    for (const id of toRemove) {
      const entry = existingMap.get(id);
      if (entry) {
        bbCollection.remove(entry.billboard);
        lblCollection.remove(entry.label);
        existingMap.delete(id);
      }
    }
  }, [cameras, selectedCamera, viewer, isOccluded, getDistanceScale, getTranslucency, getLabelOpacity]);

  // Update occlusion, distance-based scaling, and label visibility on camera move (throttled to 2Hz)
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Remove old listener
    if (preRenderRef.current) {
      viewer.scene.preRender.removeEventListener(preRenderRef.current);
      preRenderRef.current = null;
    }

    let lastUpdate = 0;
    const onPreRender = () => {
      const now = Date.now();
      if (now - lastUpdate < 500) return; // 2Hz throttle
      lastUpdate = now;

      const viewerCameraPos = viewer.camera.positionWC;
      const cameraAlt = viewer.camera.positionCartographic?.height || 20000000;
      const showLabels = cameraAlt < 500000;
      const map = cameraMapRef.current;

      map.forEach((entry) => {
        const occluded = isOccluded(entry.position);
        const distance = Cartesian3.distance(viewerCameraPos, entry.position);
        const scale = getDistanceScale(distance);
        const translucency = getTranslucency(distance);
        const labelOpacity = getLabelOpacity(distance);

        const isSelected = selectedCamera?.id === entry.camera.id;
        const color = isSelected ? COLOR_SELECTED : getCountryColor(entry.camera.country);
        const finalScale = isSelected ? scale * 1.5 : scale;

        entry.billboard.show = !occluded;
        entry.billboard.scale = finalScale;
        entry.billboard.color = color.withAlpha(translucency);

        entry.label.show = !occluded && showLabels && labelOpacity > 0.05;
        entry.label.fillColor = color.withAlpha(labelOpacity * translucency);
      });
    };

    viewer.scene.preRender.addEventListener(onPreRender);
    preRenderRef.current = onPreRender;

    return () => {
      if (preRenderRef.current && viewer && !viewer.isDestroyed()) {
        viewer.scene.preRender.removeEventListener(preRenderRef.current);
        preRenderRef.current = null;
      }
    };
  }, [viewer, isOccluded, selectedCamera, getDistanceScale, getTranslucency, getLabelOpacity]);

  return null;
}
