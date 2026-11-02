const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'server');
const files = [...fs.readdirSync(path.join(root, 'routes')).map((f) => path.join(root, 'routes', f)), path.join(root, 'services', 'gameEngine.js')];
const re = /registerHit\(|registerShot\(|INSERT INTO (hits|shots|sessions|players)|UPDATE (players|attributes|achievements)|generateSimulated|router\.(post|put|delete)\(/i;
for (const f of files) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => { if (re.test(l)) console.log(`${path.basename(f)}:${i + 1}: ${l.trim()}`); });
}
