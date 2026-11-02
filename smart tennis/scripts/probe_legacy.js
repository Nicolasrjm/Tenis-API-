const g = require('../server/services/gameEngine');
console.log('registerShot exportado:', typeof g.registerShot, '| generateSimulatedShot:', typeof g.generateSimulatedShot);
const s = g.generateSimulatedSensorHit(2, null);
console.log('generateSimulatedSensorHit(2):', JSON.stringify(s));
