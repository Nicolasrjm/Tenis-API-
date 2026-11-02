const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\nicolas\\.gemini\\antigravity\\brain\\a6a3ac35-a442-458b-b219-6c6c7b7e56e4';

async function testDir(dirPath, port, name) {
  console.log(`[TEST] Starting server in ${dirPath} on port ${port}...`);
  const srv = spawn(process.execPath, ['server/index.js'], {
    cwd: dirPath,
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore'
  });

  await new Promise((r) => setTimeout(r, 2500));

  const shotPath = path.join(artifactDir, `${name}.png`);
  console.log(`[CHROME] Capturing ${name} to ${shotPath}...`);
  const chrome = spawn(chromePath, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1280,900',
    `--screenshot=${shotPath}`,
    `http://127.0.0.1:${port}/app/play`
  ]);

  await new Promise((r) => chrome.on('exit', r));
  console.log(`[DONE] ${name} exists:`, fs.existsSync(shotPath), 'size:', fs.existsSync(shotPath) ? fs.statSync(shotPath).size : 0);
  srv.kill();
}

async function main() {
  await testDir('C:\\Users\\nicolas\\Desktop\\smart tennis', 3150, 'screenshot_smart_tennis_old');
  await testDir('C:\\Users\\nicolas\\Desktop\\Tenis-API-\\smart tennis', 3151, 'screenshot_tenis_api_current');
}

main().catch(console.error);
