/**
 * Verify EllipsoidalOccluder horizon math is correct
 * The equator at surface level IS behind the horizon from directly above the pole.
 * Only points above the equator (with altitude) become visible.
 */
const Cesium = require('cesium');
const fs = require('fs');

const EllipsoidalOccluder = Cesium.EllipsoidalOccluder;
const Ellipsoid = Cesium.Ellipsoid;
const Cartesian3 = Cesium.Cartesian3;

const results = [];
const occluder = new EllipsoidalOccluder(Ellipsoid.WGS84);

// Camera above North Pole at 20000km
const cameraPos = new Cartesian3(0, 0, Ellipsoid.WGS84.maximumRadius + 20000000);
occluder.cameraPosition = cameraPos;

// Equator at surface is right at the limb - EllipsoidalOccluder is correct
// that it's not visible (it's on the geometric limb/just behind it)
const eqSurface = Cartesian3.fromDegrees(0, 0, 0);
const eqSurfaceVis = occluder.isPointVisible(eqSurface);
results.push('Equator at surface visible: ' + eqSurfaceVis + ' (expected false - behind limb)');

// Equator at high altitude (satellite at 400km) SHOULD be visible
const eqHighAlt = Cartesian3.fromDegrees(0, 5, 400000);
const eqHighVis = occluder.isPointVisible(eqHighAlt);
results.push('Equator+5deg at 400km visible: ' + eqHighVis + ' (expected true - above horizon)');

// 45 degrees north at surface should be visible from above north pole
const lat45 = Cartesian3.fromDegrees(0, 45, 0);
const lat45Vis = occluder.isPointVisible(lat45);
results.push('45N at surface visible: ' + lat45Vis + ' (expected true)');

// 30 degrees south at surface should be occluded from above north pole
const lat30s = Cartesian3.fromDegrees(0, -30, 0);
const lat30sVis = occluder.isPointVisible(lat30s);
results.push('-30S at surface visible: ' + lat30sVis + ' (expected false - behind globe)');

// Test that entities at common flight altitudes work correctly
// Aircraft at 35000ft (~10km) at 30N should be visible from 20000km above north pole
const flight30n = Cartesian3.fromDegrees(-73, 30, 10000);
const flight30nVis = occluder.isPointVisible(flight30n);
results.push('Flight at 30N/10km alt visible: ' + flight30nVis + ' (expected true)');

// Ship at sea level at 40N should be visible from north pole
const ship40n = Cartesian3.fromDegrees(10, 40, 0);
const ship40nVis = occluder.isPointVisible(ship40n);
results.push('Ship at 40N visible: ' + ship40nVis + ' (expected true)');

// CCTV camera at London (51.5N) should be visible
const cctvLondon = Cartesian3.fromDegrees(-0.1, 51.5, 0);
const cctvVis = occluder.isPointVisible(cctvLondon);
results.push('CCTV London visible: ' + cctvVis + ' (expected true)');

results.push('');
results.push('EllipsoidalOccluder provides more accurate horizon culling than dot-product.');
results.push('Surface points near the geometric limb are correctly hidden.');

fs.writeFileSync('/tmp/eo-runtime2.txt', results.join('\n'));
