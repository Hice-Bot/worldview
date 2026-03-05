/**
 * TrackingManager - Lightweight singleton for cross-component tracking position updates.
 *
 * EntityClickHandler stores the tracking position ref here when creating a
 * temporary tracking entity. FlightLayer, ShipLayer, etc. call updatePosition()
 * to keep the camera following the entity as it moves.
 *
 * The CallbackProperty on the tracking entity reads from the stored Cartesian3,
 * so writing to it triggers smooth camera movement on the next frame.
 */
import { Cartesian3 } from 'cesium';

class TrackingManager {
  private _positionRef: Cartesian3 | null = null;
  private _trackedId: string | null = null;
  private _trackedType: string | null = null;

  /**
   * Called by EntityClickHandler when a billboard entity is tracked.
   * Stores a reference to the Cartesian3 used by the CallbackProperty.
   */
  setTracking(posRef: Cartesian3, id: string, type: string) {
    this._positionRef = posRef;
    this._trackedId = id;
    this._trackedType = type;
  }

  /**
   * Called by EntityClickHandler when tracking is cleared.
   */
  clearTracking() {
    this._positionRef = null;
    this._trackedId = null;
    this._trackedType = null;
  }

  /**
   * Called by layer components (FlightLayer, ShipLayer, etc.) to update
   * the tracked entity's position for smooth camera following.
   */
  updatePosition(id: string, type: string, lon: number, lat: number, altMeters: number) {
    if (this._positionRef && this._trackedId === id && this._trackedType === type) {
      const newPos = Cartesian3.fromDegrees(lon, lat, altMeters);
      Cartesian3.clone(newPos, this._positionRef);
    }
  }

  /**
   * Returns the currently tracked entity id and type, or null if nothing is tracked.
   */
  getTracked(): { id: string; type: string } | null {
    if (this._trackedId && this._trackedType) {
      return { id: this._trackedId, type: this._trackedType };
    }
    return null;
  }
}

// Singleton instance
export const trackingManager = new TrackingManager();
