const fs = require('fs');
const path = require('path');
const pats = process.argv.slice(2).map((p) => new RegExp(p, 'i'));
function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (f.name === 'node_modules' || f.name === 'android' || f.name === 'public' || f.name === 'dist') continue;
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.(js|jsx|bat|md)$/.test(f.name)) {
      fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => { if (pats.some((r) => r.test(l))) console.log(`${path.relative(path.join(__dirname, '..'), p)}:${i + 1}: ${l.trim().slice(0, 140)}`); });
    }
  }
}
walk(path.join(__dirname, '..'));
