const { initializeDatabase } = require('../server/database/initDb');
const { get, all, run } = require('../server/database/db');
const {
  FIXED_SECTORS,
  WALL_PRESETS,
  detectSector,
  registerHit
} = require('../server/services/gameEngine');

async function runTests() {
  console.log('====================================================');
  console.log('🎾 TESTE DE VERIFICAÇÃO: SMART TENNIS');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Inicialização do Banco e Migrações
    console.log('\n[1/5] Testando Banco de Dados e Migrações...');
    await initializeDatabase(false);

    const setting = await get(`SELECT value FROM system_settings WHERE key = 'wall_preset'`);
    assert(setting && (setting.value === 'medium' || setting.value === 'small' || setting.value === 'large'), 'system_settings possui wall_preset');

    const eq = await get(`SELECT wall_preset FROM equipments LIMIT 1`);
    assert(eq !== undefined, 'Coluna wall_preset existe na tabela equipments');

    // 2. Geometria dos 6 Setores Retangulares
    console.log('\n[2/5] Testando Mapeamento dos 6 Setores Retangulares (3x2)...');
    assert(FIXED_SECTORS.length === 6, 'Exatamente 6 setores configurados');

    const s1 = detectSector(10, 20); // Topo Esquerda
    assert(s1.sectorId === 1, 'Coordenadas (10, 20) mapeiam para Setor 1');

    const s2 = detectSector(50, 20); // Topo Centro
    assert(s2.sectorId === 2, 'Coordenadas (50, 20) mapeiam para Setor 2');

    const s3 = detectSector(90, 20); // Topo Direita
    assert(s3.sectorId === 3, 'Coordenadas (90, 20) mapeiam para Setor 3');

    const s4 = detectSector(10, 80); // Fundo Esquerda
    assert(s4.sectorId === 4, 'Coordenadas (10, 80) mapeiam para Setor 4');

    const s5 = detectSector(50, 80); // Fundo Centro
    assert(s5.sectorId === 5, 'Coordenadas (50, 80) mapeiam para Setor 5');

    const s6 = detectSector(90, 80); // Fundo Direita
    assert(s6.sectorId === 6, 'Coordenadas (90, 80) mapeiam para Setor 6');

    // 3. Presets da Parede
    console.log('\n[3/5] Testando Presets da Parede (Etapa 4)...');
    assert(WALL_PRESETS.small.width === 2.0 && WALL_PRESETS.small.height === 1.5, 'Preset Pequena: 2m x 1,5m');
    assert(WALL_PRESETS.medium.width === 3.0 && WALL_PRESETS.medium.height === 2.0, 'Preset Média: 3m x 2m (Padrão)');
    assert(WALL_PRESETS.large.width === 4.0 && WALL_PRESETS.large.height === 3.0, 'Preset Grande: 4m x 3m');

    // 4. Registro de Impacto e Flag de Simulação
    console.log('\n[4/5] Testando Processamento de Impactos e Simulação...');
    const hitResult = await registerHit({
      userId: 1,
      equipmentId: 1,
      gameMode: 'clear_all',
      sectorId: 3,
      x: 85,
      y: 25,
      speed: 88,
      source: 'mouse',
      is_simulation: true
    });

    assert(hitResult && hitResult.hit, 'Impacto registrado com sucesso');
    assert(hitResult.hit.target_id === 3, 'Setor atingido corretamente registrado como 3');

    const savedHit = await get(`SELECT * FROM hits WHERE id = ?`, [hitResult.hit.id]);
    assert(savedHit && savedHit.is_simulation === 1, 'Hit salvo com is_simulation = 1');

    // 5. Verificação da Persistência de Configuração da Parede
    console.log('\n[5/5] Testando Persistência da Parede no Banco...');
    await run(`UPDATE system_settings SET value = 'large', updated_at = CURRENT_TIMESTAMP WHERE key = 'wall_preset'`);
    const checkLarge = await get(`SELECT value FROM system_settings WHERE key = 'wall_preset'`);
    assert(checkLarge.value === 'large', 'Configuração alterada para "large" salva');

    // Restaura para o padrão Média
    await run(`UPDATE system_settings SET value = 'medium', updated_at = CURRENT_TIMESTAMP WHERE key = 'wall_preset'`);
    const checkMedium = await get(`SELECT value FROM system_settings WHERE key = 'wall_preset'`);
    assert(checkMedium.value === 'medium', 'Configuração padrão "medium" restaurada');

    console.log('\n====================================================');
    console.log(`RESULTADO FINAL: ${passed} passaram, ${failed} falharam.`);
    console.log('====================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('ERRO DURANTE TESTE:', error);
    process.exit(1);
  }
}

runTests();
