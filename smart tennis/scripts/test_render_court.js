const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\nicolas\\.gemini\\antigravity\\brain\\a6a3ac35-a442-458b-b219-6c6c7b7e56e4';

// We extract the CSS from server/public/assets/index-DU0HEssH.css
const cssContent = fs.readFileSync('C:/Users/nicolas/Desktop/Tenis-API-/smart tennis/server/public/assets/index-DU0HEssH.css', 'utf8');
const { calculateWallGeometry } = require('C:/Users/nicolas/Desktop/Tenis-API-/smart tennis/server/services/wallGeometry');

function generateHtml(presetKey) {
  const geo = calculateWallGeometry(presetKey);
  const sectorsHtml = geo.sectors.map(s => `
    <div
      id="sector-${s.id}"
      data-sector-id="${s.id}"
      style="position: absolute; left: ${s.xMin}%; top: ${s.yMin}%; width: ${s.widthPct}%; height: ${s.heightPct}%;"
      class="rounded-xl flex flex-col items-center justify-center p-2 select-none shadow-md border border-[#142A1B] bg-[#08130C] text-[#25392C]"
    >
      <div style="position: absolute; top: 8px; left: 12px; font-family: monospace; font-size: 11px; font-weight: bold; color: #3E5C49;">
        ALVO ${s.id}
      </div>
      <div style="position: absolute; top: 8px; right: 12px; font-family: monospace; font-size: 9px; color: #3E5C49;">
        ${Math.round(s.widthM * 100)}×${Math.round(s.heightM * 100)}cm
      </div>
      <div style="font-family: monospace; font-weight: 900; font-size: 64px; color: #2D4536;">
        ${s.id}
      </div>
      <div style="position: absolute; bottom: 8px; font-family: monospace; font-size: 10px; font-weight: bold; color: #3E5C49;">
        LIVRE
      </div>
    </div>
  `).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${cssContent}
    body { background: #07110B; margin: 0; padding: 20px; font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 90vh; }
  </style>
</head>
<body>
  <div style="width: 900px; max-width: 95vw;">
    <div
      id="wall-container"
      style="aspect-ratio: ${geo.aspectRatio};"
      class="relative w-full bg-[#050D07] border-4 border-[#16C96B]/60 shadow-[0_0_50px_rgba(22,201,107,0.15)] rounded-2xl overflow-hidden"
    >
      <!-- Guia visual sutil dos corredores neutros de 30 cm e margens de 10 cm -->
      <div class="absolute inset-0 pointer-events-none opacity-20">
        <div class="w-full h-full border border-dashed border-[#39FF88]/40"></div>
      </div>

      ${sectorsHtml}

      <div class="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30 text-[10px] font-mono tracking-widest text-[#8C9891]">
        [ ESPAÇAMENTO 30 CM ]
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function renderPreset(presetKey) {
  const html = generateHtml(presetKey);
  const htmlPath = path.join(artifactDir, `test_court_${presetKey}.html`);
  const shotPath = path.join(artifactDir, `test_court_${presetKey}.png`);
  fs.writeFileSync(htmlPath, html, 'utf8');

  const chrome = spawn(chromePath, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1200,800',
    `--screenshot=${shotPath}`,
    `file:///${htmlPath.replace(/\\/g, '/')}`
  ]);

  await new Promise((r) => chrome.on('exit', r));
  console.log(`Rendered ${presetKey}: ${shotPath} (size: ${fs.statSync(shotPath).size})`);
}

async function main() {
  await renderPreset('medium');
  await renderPreset('small');
  await renderPreset('large');
}

main().catch(console.error);
