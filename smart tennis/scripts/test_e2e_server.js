const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function testServer() {
  console.log('Testando requisições no servidor local...');

  // Test 1: Status
  const statusRes = await request({
    host: '127.0.0.1',
    port: 3000,
    path: '/api/status',
    method: 'GET'
  });
  console.log('[API /api/status]', statusRes.status, statusRes.body.product);

  // Test 2: Wall Config
  const wallRes = await request({
    host: '127.0.0.1',
    port: 3000,
    path: '/api/sensors/wall-config',
    method: 'GET'
  });
  console.log('[API /api/sensors/wall-config]', wallRes.status, wallRes.body.preset, wallRes.body.label);

  // Test 3: Hardware Hit
  const hitRes = await request({
    host: '127.0.0.1',
    port: 3000,
    path: '/api/hardware/hit',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    sector_id: 2,
    x: 50,
    y: 25,
    speed: 85,
    game_mode: 'free',
    source: 'mouse',
    is_simulation: true
  });
  console.log('[API /api/hardware/hit]', hitRes.status, hitRes.body.message);

  // Test 4: Frontend HTML
  const frontendRes = await request({
    host: '127.0.0.1',
    port: 3000,
    path: '/',
    method: 'GET'
  });
  const hasRoot = typeof frontendRes.body === 'string' && frontendRes.body.includes('id="root"');
  console.log('[Frontend Index HTML]', frontendRes.status, 'Contains #root:', hasRoot);

  if (statusRes.status === 200 && wallRes.status === 200 && hitRes.status === 201 && hasRoot) {
    console.log('✅ TODOS OS TESTES E2E NO SERVIDOR PASSARAM COM SUCESSO!');
    process.exit(0);
  } else {
    console.error('❌ ALGUNS TESTES FALHARAM');
    process.exit(1);
  }
}

testServer().catch(err => {
  console.error('Erro de conexão (servidor pode estar desligado na porta 3000):', err.message);
  process.exit(2);
});
