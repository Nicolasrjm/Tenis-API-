/**
 * test_leitura_cloud_desktop.js
 * 
 * Validação direcionada da leitura em nuvem no Desktop (Vercel / Cloud Mode):
 * 1. api.getPlayer() em modo cloud
 * 2. api.updatePlayer() em modo cloud
 * 3. api.getSessions() em modo cloud
 * 4. api.getRecentShots() em modo cloud
 * 5. api.getAttributes() e api.getSkillTree() em modo cloud
 * 6. api.getHitMapData() em modo cloud
 * 7. Bloqueio estrito de fetchJson('/api') sem servidor Express
 * 8. Estado da fila Outbox (leitura SQLite da partida de Nicolas)
 */

const assert = require('assert');
const path = require('path');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    testsFailed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    testsFailed++;
  }
}

// Mock de localStorage
const localStorageStore = {};
globalThis.localStorage = {
  getItem: (key) => localStorageStore[key] || null,
  setItem: (key, val) => { localStorageStore[key] = String(val); },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }
};

// Mock de window
globalThis.window = {
  location: { hostname: 'tenis-api-client.vercel.app', protocol: 'https:', host: 'tenis-api-client.vercel.app' },
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
  dispatchEvent: () => {}
};

async function main() {
  console.log('\n======================================================');
  console.log('TESTES DIRECIONADOS: LEITURA CLOUD DESKTOP E SINCRONIZAÇÃO');
  console.log('======================================================\n');

  // 1. Carrega serviços
  const { isWebDemoMode, isCloudOnlyMode, isEquipmentMode } = await import('../client/src/services/appEnvironment.js');
  const { cloudDataService } = await import('../client/src/services/cloudDataService.js');
  const { api, fetchJson } = await import('../client/src/services/api.js');

  console.log('[1] VERIFICAÇÃO DE AMBIENTE VERCEL:');
  runTest('Detecta modo web_demo em host *.vercel.app', () => {
    assert.strictEqual(isWebDemoMode(), true);
    assert.strictEqual(isCloudOnlyMode(), true);
    assert.strictEqual(isEquipmentMode(), false);
  });

  console.log('\n[2] PROTEÇÃO CONTRA CHAMADAS /API EM MODO CLOUD:');
  await runAsyncTest('fetchJson rejeita com NO_LOCAL_SERVER ao invés de buscar HTML na Vercel', async () => {
    let threw = false;
    try {
      await fetchJson('/test-endpoint');
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'NO_LOCAL_SERVER');
      assert.strictEqual(err.message.includes('servidor Express local da quadra não conectado'), true);
    }
    assert.strictEqual(threw, true);
  });

  console.log('\n[3] PERFIL DESKTOP EM MODO CLOUD:');
  const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjNTYyNzkwMi01ODMxLTRhMGUtOTdkMS0xYmMwZmExYzI4NGMiLCJlbWFpbCI6Im5pY29sYXNyam0yQGdtYWlsLmNvbSIsImlzcyI6Imh0dHBzOi8vcHN0em1idHFrY3JodGR2d3FudXYuc3VwYWJhc2UuY28vYXV0aC92MSJ9.signature';

  // Configura sessão cloud no localStorage
  localStorage.setItem('mt_cloud_session', JSON.stringify({
    accessToken: mockToken,
    user: {
      id: 'c5627902-5831-4a0e-97d1-1bc0fa1c284c',
      email: 'nicolasrjm2@gmail.com',
      user_metadata: { name: 'Nicolas RJ' },
      avatar: '🎾'
    }
  }));

  await runAsyncTest('api.getPlayer() em modo cloud retorna perfil sem chamar Express', async () => {
    // Mock de cloudDataService.getCloudAthleteOverview
    const originalGetOverview = cloudDataService.getCloudAthleteOverview;
    cloudDataService.getCloudAthleteOverview = async () => ({
      profile: {
        user_id: 'c5627902-5831-4a0e-97d1-1bc0fa1c284c',
        display_name: 'Nicolas RJ',
        avatar: '🎾',
        level: 2,
        xp: 258,
        xp_next: 500,
        title: 'Praticante',
        overall_accuracy: 46.15,
        total_shots: 13,
        total_hits: 6
      },
      totalSessionsCount: 1,
      bestScore: 510
    });

    try {
      const player = await api.getPlayer();
      assert.ok(player);
      assert.strictEqual(player.name, 'Nicolas RJ');
      assert.strictEqual(player.xp, 258);
      assert.strictEqual(player.level, 2);
      assert.strictEqual(player.best_score, 510);
      assert.strictEqual(player.isCloudOnly, true);
    } finally {
      cloudDataService.getCloudAthleteOverview = originalGetOverview;
    }
  });

  await runAsyncTest('api.updatePlayer() em modo cloud atualiza Supabase sem chamar Express', async () => {
    let patchCalled = false;
    let patchBody = null;

    const originalUpdateCloud = cloudDataService.updateCloudProfile;
    cloudDataService.updateCloudProfile = async ({ name, avatar }) => {
      patchCalled = true;
      patchBody = { name, avatar };
      return { display_name: name, avatar };
    };

    try {
      const updated = await api.updatePlayer({ name: 'Nicolas Campeão', avatar: '🏆' });
      assert.strictEqual(patchCalled, true);
      assert.strictEqual(patchBody.name, 'Nicolas Campeão');
      assert.strictEqual(patchBody.avatar, '🏆');
      assert.strictEqual(updated.name, 'Nicolas Campeão');
      assert.strictEqual(updated.avatar, '🏆');

      // Verifica se o localStorage foi atualizado
      const session = JSON.parse(localStorage.getItem('mt_cloud_session'));
      assert.strictEqual(session.user.user_metadata.name, 'Nicolas Campeão');
      assert.strictEqual(session.user.avatar, '🏆');
    } finally {
      cloudDataService.updateCloudProfile = originalUpdateCloud;
    }
  });

  console.log('\n[4] HISTÓRICO DESKTOP EM MODO CLOUD:');
  await runAsyncTest('api.getSessions() e api.getRecentShots() executam sem rejeição', async () => {
    const originalGetSessions = cloudDataService.getCloudSessions;
    const originalGetRecentShots = cloudDataService.getCloudRecentShots;

    cloudDataService.getCloudSessions = async () => ({
      sessions: [
        {
          id: 'cloud_sess_001',
          started_at: '2026-11-03T16:40:13.080Z',
          ended_at: '2026-11-03T16:40:24.876Z',
          mode: 'free',
          total_score: 510,
          accuracy: 46.15,
          shots_count: 13,
          hits_count: 6,
          duration_seconds: 12,
          xp_granted: 258
        }
      ],
      totalCount: 1
    });

    cloudDataService.getCloudRecentShots = async () => [
      {
        id: 'shot_1',
        zone: 'Setor 2',
        sector_id: 2,
        x: 53.6,
        y: 27.6,
        force: 88,
        force_kmh: 88,
        score: 85,
        is_hit: true,
        is_bullseye: true
      }
    ];

    try {
      const [sessions, shots] = await Promise.all([
        api.getSessions(30),
        api.getRecentShots(40)
      ]);

      assert.strictEqual(sessions.length, 1);
      assert.strictEqual(sessions[0].total_score, 510);
      assert.strictEqual(sessions[0].xp_granted, 258);
      assert.strictEqual(shots.length, 1);
      assert.strictEqual(shots[0].score, 85);
      assert.strictEqual(shots[0].zone, 'Setor 2');
    } finally {
      cloudDataService.getCloudSessions = originalGetSessions;
      cloudDataService.getCloudRecentShots = originalGetRecentShots;
    }
  });

  console.log('\n[5] EVOLUÇÃO E HABILIDADES EM MODO CLOUD:');
  await runAsyncTest('api.getAttributes(), api.getSkillTree() e unlockSkillNode() funcionam em cloud', async () => {
    const attrs = await api.getAttributes();
    assert.strictEqual(attrs.length, 6);
    assert.strictEqual(attrs[0].key, 'precision');

    const tree = await api.getSkillTree();
    assert.ok(Array.isArray(tree));
    assert.strictEqual(tree.length, 4);

    const unlockRes = await api.unlockSkillNode('tree_2');
    assert.strictEqual(unlockRes.success, true);
  });

  console.log('\n[6] DESEMPENHO E HITMAP EM MODO CLOUD:');
  await runAsyncTest('api.getHitMapData() retorna estrutura íntegra sem chamar /api', async () => {
    const hitmap = await api.getHitMapData();
    assert.ok(hitmap);
    assert.ok(Array.isArray(hitmap.shots));
    assert.strictEqual(hitmap.totalHits, 0);
  });

  console.log('\n[7] VERIFICAÇÃO LEITURA SQLITE DA PARTIDA DE NICOLAS:');
  await runAsyncTest('Inspeciona outbox row 6 e valida dados da partida de 510 pts', async () => {
    const db = require('../server/database/db');
    const row = await db.get('SELECT * FROM cloud_outbox WHERE id = 6');
    assert.ok(row, 'Row 6 deve existir na outbox');
    assert.strictEqual(row.cloud_user_id, 'c5627902-5831-4a0e-97d1-1bc0fa1c284c');
    assert.strictEqual(row.equipment_id, '8af21599-a4ee-4aad-a3eb-ac15dd678c99');
    assert.strictEqual(row.status, 'pending');
    assert.strictEqual(row.last_error, 'PLAYER_NEVER_PAIRED_WITH_EQUIPMENT');

    const payload = JSON.parse(row.payload_json);
    assert.strictEqual(payload.payload.total_score, 510);
    assert.strictEqual(payload.payload.xp_granted, 258);
    assert.strictEqual(payload.payload.shots_count, 13);
    assert.strictEqual(payload.payload.hits_count, 6);
  });

  console.log('\n------------------------------------------------------');
  console.log(`TOTAL: ${testsPassed} PASSOU, ${testsFailed} FALHOU`);
  console.log('------------------------------------------------------\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Erro fatal nos testes:', e);
  process.exit(1);
});
