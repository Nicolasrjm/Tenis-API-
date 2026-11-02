const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\nicolas\\.gemini\\antigravity\\brain\\a6a3ac35-a442-458b-b219-6c6c7b7e56e4';
const { calculateWallGeometry } = require('C:/Users/nicolas/Desktop/Tenis-API-/smart tennis/server/services/wallGeometry');

function getSectorStyles(gameMode, sectorId, activeSectorId = 2, sectorStates = { 1: true, 2: false, 3: true, 4: true, 5: false, 6: true }) {
  if (gameMode === 'free') {
    return {
      cardClass: 'bg-[#0A1F13] border-2 border-[#16C96B] shadow-[0_4px_24px_rgba(0,0,0,0.6),inset_0_0_20px_rgba(22,201,107,0.08)] hover:border-[#39FF88] hover:bg-[#0F2D1C]',
      numClass: 'text-[#F5F7F5]',
      badgeClass: 'text-[#39FF88]',
      dimClass: 'text-[#8C9891]',
      statusText: 'LIVRE',
      statusClass: 'text-[#39FF88]'
    };
  } else if (gameMode === 'single') {
    const isTarget = sectorId === activeSectorId;
    if (isTarget) {
      return {
        cardClass: 'bg-[#39FF88] text-[#07110B] border-4 border-white shadow-[0_0_40px_rgba(57,255,136,0.8),inset_0_0_20px_rgba(255,255,255,0.7)] z-10 animate-pulse',
        numClass: 'text-[#07110B]',
        badgeClass: 'text-[#07110B]',
        dimClass: 'text-[#07110B]',
        statusText: '★ ACERTE AQUI ★',
        statusClass: 'text-[#07110B] font-black'
      };
    } else {
      return {
        cardClass: 'bg-[#06130B] border-2 border-[#16C96B]/20 shadow-[0_4px_16px_rgba(0,0,0,0.5)]',
        numClass: 'text-[#1F3E2B]',
        badgeClass: 'text-[#2D5A3D]',
        dimClass: 'text-[#1F3E2B]',
        statusText: 'AGUARDANDO',
        statusClass: 'text-[#2D5A3D]'
      };
    }
  } else if (gameMode === 'clear_all') {
    const isOn = sectorStates[sectorId] !== false;
    if (isOn) {
      return {
        cardClass: 'bg-[#16C96B] text-[#07110B] border-2 border-[#39FF88] shadow-[0_0_30px_rgba(22,201,107,0.5),inset_0_0_15px_rgba(57,255,136,0.3)] z-10',
        numClass: 'text-[#07110B]',
        badgeClass: 'text-[#07110B]',
        dimClass: 'text-[#07110B]',
        statusText: 'ACESO',
        statusClass: 'text-[#07110B] font-black'
      };
    } else {
      return {
        cardClass: 'bg-[#050E08] border border-[#16C96B]/15 shadow-[inset_0_0_15px_rgba(0,0,0,0.8)]',
        numClass: 'text-[#1A2E22]',
        badgeClass: 'text-[#263D2E]',
        dimClass: 'text-[#1A2E22]',
        statusText: 'APAGADO',
        statusClass: 'text-[#263D2E]'
      };
    }
  }
}

function renderHtml(presetKey, gameMode) {
  const geo = calculateWallGeometry(presetKey);
  const sectorsHtml = geo.sectors.map(s => {
    const st = getSectorStyles(gameMode, s.id);
    return `
    <div
      id="sector-${s.id}"
      data-sector-id="${s.id}"
      style="position: absolute; left: ${s.xMin}%; top: ${s.yMin}%; width: ${s.widthPct}%; height: ${s.heightPct}%; border-radius: 14px;"
      class="flex flex-col items-center justify-center p-3 select-none transition-all duration-150 ${st.cardClass}"
    >
      <div style="position: absolute; top: 10px; left: 14px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.05em;" class="${st.badgeClass}">
        ALVO ${s.id}
      </div>
      <div style="position: absolute; top: 10px; right: 14px; font-family: 'JetBrains Mono', monospace; font-size: 10px;" class="${st.dimClass}">
        ${Math.round(s.widthM * 100)}×${Math.round(s.heightM * 100)}cm
      </div>
      <div style="font-family: 'JetBrains Mono', monospace; font-weight: 900; font-size: 72px; line-height: 1;" class="${st.numClass}">
        ${s.id}
      </div>
      <div style="position: absolute; bottom: 10px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;" class="${st.statusClass}">
        ${st.statusText}
      </div>
    </div>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=JetBrains+Mono:wght@700;900&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #07110B;
      color: #F5F7F5;
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .hud {
      width: 1000px;
      max-width: 95vw;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #8C9891;
    }
    .hud strong { color: #39FF88; }
    .wall-wrapper {
      width: 1000px;
      max-width: 95vw;
      position: relative;
    }
    .wall-container {
      position: relative;
      width: 100%;
      aspect-ratio: ${geo.aspectRatio};
      background: #030905;
      border: 4px solid rgba(22, 201, 107, 0.55);
      border-radius: 20px;
      box-shadow: 0 0 60px rgba(22, 201, 107, 0.18), inset 0 0 40px rgba(0, 0, 0, 0.8);
      overflow: hidden;
    }
  </style>
</head>
<body>
  <div class="hud">
    <div>MODO: <strong>${gameMode.toUpperCase()}</strong> | PRESET: <strong>${geo.label.toUpperCase()} (${geo.widthM}m × ${geo.heightM}m)</strong></div>
    <div>CORREDORES: <strong>30 cm</strong> | MARGENS: <strong>10 cm</strong></div>
  </div>
  <div class="wall-wrapper">
    <div class="wall-container">
      ${sectorsHtml}
    </div>
  </div>
</body>
</html>`;
}

async function capture(preset, mode, filename) {
  const html = renderHtml(preset, mode);
  const htmlPath = path.join(artifactDir, `${filename}.html`);
  const shotPath = path.join(artifactDir, `${filename}.png`);
  fs.writeFileSync(htmlPath, html, 'utf8');

  const chrome = spawn(chromePath, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1200,850',
    `--screenshot=${shotPath}`,
    `file:///${htmlPath.replace(/\\/g, '/')}`
  ]);

  await new Promise((r) => chrome.on('exit', r));
  console.log(`Captured ${filename}: size ${fs.statSync(shotPath).size} bytes`);
}

async function main() {
  await capture('medium', 'free', 'targets_medium_free');
  await capture('medium', 'single', 'targets_medium_single');
  await capture('medium', 'clear_all', 'targets_medium_clear_all');
  await capture('small', 'free', 'targets_small_free');
  await capture('large', 'free', 'targets_large_free');
}

main().catch(console.error);
