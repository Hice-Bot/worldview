/**
 * Runtime test of EllipsoidalOccluder behavior
 * Verifies that points behind the globe are correctly identified as occluded
 */
const Cesium = require('cesium');
const fs = require('fs');

const EllipsoidalOccluder = Cesium.EllipsoidalOccluder;
const Ellipsoid = Cesium.Ellipsoid;
const Cartesian3 = Cesium.Cartesian3;

const results = [];

// Create occluder with WGS84 ellipsoid
const occluder = new EllipsoidalOccluder(Ellipsoid.WGS84);

// Camera above North Pole at ~20000km altitude
const cameraPos = new Cartesian3(0, 0, Ellipsoid.WGS84.maximumRadius + 20000000);
occluder.cameraPosition = cameraPos;

// Test 1: Point on same side (North Pole surface) should be visible
const northPole = Cartesian3.fromDegrees(0, 89, 0);
const northVisible = occluder.isPointVisible(northPole);
results.push(northVisible ? 'PASS: North Pole visible from above North Pole' : 'FAIL: North Pole should be visible');

// Test 2: Point on far side (South Pole surface) should be occluded
const southPole = Cartesian3.fromDegrees(0, -89, 0);
const southVisible = occluder.isPointVisible(southPole);
results.push(!southVisible ? 'PASS: South Pole occluded from above North Pole' : 'FAIL: South Pole should be occluded');

// Test 3: Point at equator (near horizon) — should be visible from high up
const equator = Cartesian3.fromDegrees(0, 0, 0);
const equatorVisible = occluder.isPointVisible(equator);
results.push(equatorVisible ? 'PASS: Equator visible from very high altitude' : 'FAIL: Equator should be visible from 20000km');

// Test 4: Flight at cruise altitude over London (visible hemisphere)
const londonFlight = Cartesian3.fromDegrees(-0.1, 51.5, 10000);
const londonVisible = occluder.isPointVisible(londonFlight);
results.push(londonVisible ? 'PASS: London flight visible from above North Pole' : 'FAIL: London flight should be visible');

// Test 5: Satellite over South America (far side when viewing from North Pole)
const southAmericaSat = Cartesian3.fromDegrees(-60, -50, 400000);
const saVisible = occluder.isPointVisible(southAmericaSat);
results.push(!saVisible ? 'PASS: South America satellite occluded from North Pole view' : 'FAIL: Should be occluded at -50 lat');

// Test 6: Entities reappear - rotate camera to South Pole
const cameraSouth = new Cartesian3(0, 0, -(Ellipsoid.WGS84.maximumRadius + 20000000));
occluder.cameraPosition = cameraSouth;
const southNowVisible = occluder.isPointVisible(southPole);
const northNowOccluded = !occluder.isPointVisible(northPole);
results.push(southNowVisible ? 'PASS: South Pole reappears when camera moves south' : 'FAIL: South Pole should be visible now');
results.push(northNowOccluded ? 'PASS: North Pole occluded when camera at South Pole' : 'FAIL: North Pole should be occluded now');

// Summary
const passed = results.filter(r => r.startsWith('PASS')).length;
const total = results.length;
results.push('');
results.push('Results: ' + passed + '/' + total + ' passed');

fs.writeFileSync('/tmp/eo-runtime.txt', results.join('\n'));
