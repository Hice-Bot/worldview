/**
 * EllipsoidalOccluder-based horizon culling for far-side entity hiding.
 *
 * Uses Cesium's EllipsoidalOccluder (horizon culling algorithm) instead of
 * a simple dot-product hemisphere check. This properly accounts for the
 * ellipsoidal shape of the Earth and produces more accurate occlusion results,
 * especially near the horizon limb.
 *
 * See: https://cesium.com/blog/2013/04/25/Horizon-culling/
 */
import { Cartesian3, Ellipsoid } from 'cesium';
import * as Cesium from 'cesium';

// EllipsoidalOccluder is a @private Cesium class but is exported at runtime.
// We declare a minimal interface for type safety.
interface IEllipsoidalOccluder {
  cameraPosition: Cartesian3;
  isPointVisible(occludee: Cartesian3): boolean;
}

interface EllipsoidalOccluderConstructor {
  new (ellipsoid: Ellipsoid, cameraPosition?: Cartesian3): IEllipsoidalOccluder;
}

// Access the constructor from the Cesium namespace (available at runtime)
const EllipsoidalOccluder = (Cesium as Record<string, unknown>)
  .EllipsoidalOccluder as EllipsoidalOccluderConstructor;

/**
 * Singleton occluder instance using WGS84 ellipsoid.
 * Camera position must be updated each frame before calling isOccluded().
 */
const occluder: IEllipsoidalOccluder = new EllipsoidalOccluder(
  Ellipsoid.WGS84,
  new Cartesian3(0, 0, Ellipsoid.WGS84.maximumRadius * 3)
);

/**
 * Update the occluder's camera position. Call this once per frame (or per
 * occlusion batch) before testing points.
 */
export function updateOccluderCamera(cameraPositionWC: Cartesian3): void {
  occluder.cameraPosition = cameraPositionWC;
}

/**
 * Test whether a world-space position is occluded (hidden behind the globe).
 * Returns true if the point is NOT visible from the current camera position.
 *
 * Must call updateOccluderCamera() first to set the camera position.
 */
export function isOccluded(position: Cartesian3): boolean {
  return !occluder.isPointVisible(position);
}
