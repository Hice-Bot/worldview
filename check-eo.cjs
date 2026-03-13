const C = require('cesium');
const fs = require('fs');
const result = {
  type: typeof C.EllipsoidalOccluder,
  hasIsPointVisible: C.EllipsoidalOccluder ? typeof C.EllipsoidalOccluder.prototype.isPointVisible : 'N/A',
};
fs.writeFileSync('/tmp/eo-result.txt', JSON.stringify(result));
