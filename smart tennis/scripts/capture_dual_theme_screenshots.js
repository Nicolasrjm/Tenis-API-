const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const ARTIFACT_DIR = 'C:/Users/nicolas/.gemini/antigravity/brain/bd032840-d6df-4b7e-a645-bf173442434a';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DEBUG_PORT = 9225;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.on('open', resolve);
      this.ws.on('error', reject);
    });

    this.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function main() {
  console.log('Iniciando captura de screenshots dos temas Claro e Escuro...');
  
  // Launch Chrome
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--window-size=1280,850'
  ]);

  try {
    let versionData = null;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
        if (res.ok) {
          versionData = await res.json();
          break;
        }
      } catch (e) {}
      await sleep(150);
    }

    if (!versionData) throw new Error('Não foi possível conectar ao Chrome Headless');

    // Get or create target page
    let pageTab = null;
    try {
      const listRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const tabs = await listRes.json();
      pageTab = tabs.find((t) => t.type === 'page');
    } catch (e) {}

    if (!pageTab) {
      const newTabRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?http://127.0.0.1:3000`, { method: 'PUT' });
      pageTab = await newTabRes.json();
    }

    const client = new CDPClient(pageTab.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');

    // Navigate explicitly to landing page
    await client.send('Page.navigate', { url: 'http://127.0.0.1:3000/' });
    await sleep(2500);

    // 1. Landing Page - Dark Mode (Default)
    await client.send('Runtime.evaluate', {
      expression: `
        if (document.documentElement.classList.contains('light')) {
          const btn = document.querySelector('[data-testid="theme-toggle-btn"]');
          if (btn) btn.click();
        }
      `
    });
    await sleep(800);

    const darkLandingShot = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'screenshot_landing_dark.png'),
      Buffer.from(darkLandingShot.data, 'base64')
    );
    console.log('✔ Screenshot capturado: screenshot_landing_dark.png');

    // 2. Landing Page - Light Mode (Click Toggle Button)
    await client.send('Runtime.evaluate', {
      expression: `
        const btn = document.querySelector('[data-testid="theme-toggle-btn"]');
        if (btn) btn.click();
      `
    });
    await sleep(800);

    const lightLandingShot = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'screenshot_landing_light.png'),
      Buffer.from(lightLandingShot.data, 'base64')
    );
    console.log('✔ Screenshot capturado: screenshot_landing_light.png');

    // 3. Login Page - Light Mode
    await client.send('Page.navigate', { url: 'http://127.0.0.1:3000/#/login' });
    await sleep(1500);

    const lightLoginShot = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'screenshot_login_light.png'),
      Buffer.from(lightLoginShot.data, 'base64')
    );
    console.log('✔ Screenshot capturado: screenshot_login_light.png');

    // 4. Login Page - Dark Mode (Click Toggle Button)
    await client.send('Runtime.evaluate', {
      expression: `
        const btn = document.querySelector('[data-testid="theme-toggle-btn"]');
        if (btn) btn.click();
      `
    });
    await sleep(800);

    const darkLoginShot = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'screenshot_login_dark.png'),
      Buffer.from(darkLoginShot.data, 'base64')
    );
    console.log('✔ Screenshot capturado: screenshot_login_dark.png');

    client.close();
    console.log('Capturas concluídas com sucesso!');
  } finally {
    chromeProcess.kill();
  }
}

main().catch((err) => {
  console.error('Erro ao capturar screenshots:', err);
  process.exit(1);
});
