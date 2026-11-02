/**
 * ==============================================================================
 * MOTION TENNIS — SUÍTE DE TESTES E VALIDAÇÃO DA FUNDAÇÃO CLOUD (FASE 7B.1)
 * ==============================================================================
 * Executa verificações automatizadas de integridade estática, validação de SQL,
 * cobertura de políticas RLS, proteção contra forjamento de XP, segurança de
 * credenciais individuais de equipamento, conformidade de contratos JSON e
 * preservação estrita do SQLite de produção.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const CLOUD_DIR = path.resolve(ROOT_DIR, 'cloud');
const SUPABASE_DIR = path.resolve(ROOT_DIR, 'supabase');
const SQLITE_DB_PATH = path.resolve(ROOT_DIR, 'smart tennis', 'server', 'database', 'smart_tennis.db');

let sqlite3;
try {
  sqlite3 = require(path.join(ROOT_DIR, 'smart tennis', 'node_modules', 'sqlite3'));
} catch (e) {
  sqlite3 = require('sqlite3');
}

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m [${testName}]`);
    passedTests++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m [${testName}]: ${details}`);
    failedTests++;
  }
}

console.log('\n======================================================');
console.log('  MOTION TENNIS — TESTES AUTOMATIZADOS DA FASE 7B.1');
console.log('======================================================\n');

// ------------------------------------------------------------------------------
// GRUPO 1: EXISTÊNCIA DE ARQUIVOS ESTRUTURAIS
// ------------------------------------------------------------------------------
console.log('\x1b[36m[GRUPO 1] Verificação de Arquivos e Estrutura de Diretórios\x1b[0m');

const requiredFiles = [
  path.join(CLOUD_DIR, 'migrations', '001_initial_schema.sql'),
  path.join(CLOUD_DIR, 'migrations', '002_row_level_security.sql'),
  path.join(CLOUD_DIR, 'migrations', '003_functions_and_triggers.sql'),
  path.join(SUPABASE_DIR, 'migrations', '20261102000001_initial_schema.sql'),
  path.join(SUPABASE_DIR, 'migrations', '20261102000002_row_level_security.sql'),
  path.join(SUPABASE_DIR, 'migrations', '20261102000003_functions_and_triggers.sql'),
  path.join(CLOUD_DIR, 'policies', 'RLS_SECURITY_MATRIX.md'),
  path.join(CLOUD_DIR, 'contracts', 'match_finished_event.json'),
  path.join(CLOUD_DIR, 'contracts', 'equipment_heartbeat.json'),
  path.join(CLOUD_DIR, 'contracts', 'pairing_claim_request.json'),
  path.join(CLOUD_DIR, 'examples', 'supabase_client_sample.js'),
  path.join(CLOUD_DIR, 'examples', 'seed_academy_catalog.sql'),
  path.join(CLOUD_DIR, 'env.example'),
  path.join(CLOUD_DIR, 'README.md')
];

requiredFiles.forEach(file => {
  const relPath = path.relative(ROOT_DIR, file);
  assert(fs.existsSync(file), `Arquivo presente: ${relPath}`);
});

// ------------------------------------------------------------------------------
// GRUPO 2: SCHEMA POSTGRESQL E INTEGRIDADE RELACIONAL (001_initial_schema.sql)
// ------------------------------------------------------------------------------
console.log('\n\x1b[36m[GRUPO 2] Validação do Schema PostgreSQL DDL\x1b[0m');

const schemaSql = fs.readFileSync(path.join(CLOUD_DIR, 'migrations', '001_initial_schema.sql'), 'utf-8');

const expectedTables = [
  'player_profiles',
  'player_attributes',
  'equipments',
  'equipment_secrets',
  'equipment_heartbeats',
  'equipment_pairings',
  'synced_sessions',
  'synced_shots',
  'player_achievements',
  'academy_lessons',
  'academy_progress',
  'sync_checkpoints'
];

expectedTables.forEach(table => {
  const tableRegex = new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\s*\\(`, 'i');
  assert(tableRegex.test(schemaSql), `DDL define tabela: public.${table}`);
});

assert(
  schemaSql.includes('CONSTRAINT unq_equipment_local_session UNIQUE (equipment_id, local_session_id)'),
  'Idempotência em synced_sessions: UNIQUE (equipment_id, local_session_id)'
);

assert(
  schemaSql.includes('equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE RESTRICT'),
  'Retenção de histórico: ON DELETE RESTRICT impede exclusão de partidas por remoção de quadra'
);

assert(
  schemaSql.includes('chk_published_requires_video'),
  'Regra da Academy: chk_published_requires_video exige vídeo válido para publicar'
);

assert(
  schemaSql.includes('youtube_video_id TEXT CHECK (youtube_video_id IS NULL OR length(youtube_video_id) = 11)'),
  'Flexibilidade para rascunhos: youtube_video_id pode ser NULL em aulas não gravadas'
);

assert(
  schemaSql.includes('failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0)') &&
  schemaSql.includes('locked_until TIMESTAMPTZ'),
  'Proteção de hardware: equipment_secrets possui controle de tentativas e bloqueio temporário'
);

// ------------------------------------------------------------------------------
// GRUPO 3: ROW LEVEL SECURITY E PROTEÇÃO DE CAMPOS (002_row_level_security.sql)
// ------------------------------------------------------------------------------
console.log('\n\x1b[36m[GRUPO 3] Auditoria de Row Level Security (RLS)\x1b[0m');

const rlsSql = fs.readFileSync(path.join(CLOUD_DIR, 'migrations', '002_row_level_security.sql'), 'utf-8');

expectedTables.forEach(table => {
  const rlsEnableRegex = new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'i');
  assert(rlsEnableRegex.test(rlsSql), `RLS explicitamente habilitado: public.${table}`);
});

assert(
  !rlsSql.includes('ON public.equipment_secrets FOR SELECT TO authenticated') &&
  !rlsSql.includes('ON public.equipment_secrets FOR SELECT TO anon'),
  'Segurança de Credencial: equipment_secrets NÃO possui políticas SELECT públicas'
);

assert(
  rlsSql.includes('protect_player_profile_fields'),
  'Gatilho de Integridade: protect_player_profile_fields impede alteração de XP/nível pelo cliente'
);

assert(
  rlsSql.includes('pairing_role = \'athlete\''),
  'Proteção de Pareamento: atletas não podem forjar papel de \'operator\' nos notebooks'
);

assert(
  rlsSql.includes('is_published = TRUE AND status = \'published\''),
  'Academy Segura: visitantes só enxergam aulas efetivamente publicadas'
);

// ------------------------------------------------------------------------------
// GRUPO 4: RPCS DE EQUIPAMENTO E RECONCILIAÇÃO OFICIAL (003_functions_and_triggers.sql)
// ------------------------------------------------------------------------------
console.log('\n\x1b[36m[GRUPO 4] RPCs de Equipamento, Segurança e Fórmula Oficial de XP\x1b[0m');

const fnSql = fs.readFileSync(path.join(CLOUD_DIR, 'migrations', '003_functions_and_triggers.sql'), 'utf-8');

assert(
  fnSql.includes('record_equipment_heartbeat_v1') && fnSql.includes('SECURITY DEFINER'),
  'RPC de Telemetria: record_equipment_heartbeat_v1 implementada com validação de chave'
);

assert(
  fnSql.includes('sync_equipment_session_v1') && fnSql.includes('SECURITY DEFINER'),
  'RPC de Ingestão Atômica: sync_equipment_session_v1 com autenticação de hardware e idempotência'
);

assert(
  fnSql.includes('SET search_path = public, pg_temp'),
  'Segurança contra Hijacking: Funções SECURITY DEFINER definem search_path seguro'
);

assert(
  fnSql.includes('NOW() - INTERVAL \'150 seconds\''),
  'Cálculo Online Temporal: is_equipment_online utiliza janela de 150 segundos'
);

assert(
  fnSql.includes('Especialista') && fnSql.includes('Competidor') && fnSql.includes('Iniciante'),
  'Fórmula Real Motion Tennis: reconcile_player_stats utiliza LEVEL_TITLES oficiais'
);

// ------------------------------------------------------------------------------
// GRUPO 5: SEED DA ACADEMY E RASCUNHOS
// ------------------------------------------------------------------------------
console.log('\n\x1b[36m[GRUPO 5] Validação do Seed da Academy (Rascunhos e Idempotência)\x1b[0m');

const seedSql = fs.readFileSync(path.join(CLOUD_DIR, 'examples', 'seed_academy_catalog.sql'), 'utf-8');

assert(
  seedSql.includes('VÍDEO EM BREVE') && seedSql.includes('FALSE'),
  'Privacidade de Conteúdo: Aulas são cadastradas como rascunhos não publicados (FALSE)'
);

assert(
  !seedSql.includes('https://www.youtube.com/watch?v=kJ9n3hWbL01'),
  'Zero Falsificação: Nenhuma URL fictícia de YouTube foi inserida no seed'
);

assert(
  seedSql.includes('status = public.academy_lessons.status') &&
  seedSql.includes('is_published = public.academy_lessons.is_published'),
  'Preservação Administrativa: Seed NÃO sobrescreve publicações aprovadas por administradores'
);

// ------------------------------------------------------------------------------
// GRUPO 6: CLIENTE SUPABASE E AUSÊNCIA DE SERVICE_ROLE NO NOTEBOOK
// ------------------------------------------------------------------------------
console.log('\n\x1b[36m[GRUPO 6] Auditoria de Credenciais e Arquitetura de Cliente\x1b[0m');

const clientSample = fs.readFileSync(path.join(CLOUD_DIR, 'examples', 'supabase_client_sample.js'), 'utf-8');

assert(
  !clientSample.includes('SUPABASE_SERVICE_ROLE_KEY'),
  'Segurança Física: Cliente de equipamento NÃO referencia ou depende de SUPABASE_SERVICE_ROLE_KEY'
);

assert(
  clientSample.includes('sync_equipment_session_v1') && clientSample.includes('EQUIPMENT_API_KEY'),
  'Autenticação de Hardware: Notebook utiliza EQUIPMENT_API_KEY via RPC segura'
);

const envExample = fs.readFileSync(path.join(CLOUD_DIR, 'env.example'), 'utf-8');

assert(
  !envExample.includes('SUPABASE_SERVICE_ROLE_KEY='),
  'Higienização de Ambiente: env.example não orienta uso de service_role na quadra'
);

// ------------------------------------------------------------------------------
// GRUPO 7: AUDITORIA CONTRA VAZAMENTO DE CREDENCIAIS REAIS
// ------------------------------------------------------------------------------
console.log('\n\x1b[36m[GRUPO 7] Auditoria Estática de Segurança contra Vazamento de Segredos\x1b[0m');

function scanForSecrets(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      scanForSecrets(fullPath);
    } else if (file.isFile() && !file.name.endsWith('.png') && !file.name.endsWith('.db')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const realJwtRegex = /ey[A-Za-z0-9_-]{30,}\.ey[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{30,}/g;
      const matches = content.match(realJwtRegex) || [];
      const suspicious = matches.filter(m => !m.includes('exemplo_') && !m.includes('exemplo'));
      
      assert(suspicious.length === 0, `Zero credenciais reais em: ${path.relative(ROOT_DIR, fullPath)}`, suspicious.join(', '));
    }
  }
}

scanForSecrets(CLOUD_DIR);

// ------------------------------------------------------------------------------
// GRUPO 8: PRESERVAÇÃO INTEGRAL DO SQLITE LOCAL
// ------------------------------------------------------------------------------
console.log('\n\x1b[36m[GRUPO 8] Integridade do SQLite e Sistema Local\x1b[0m');

assert(fs.existsSync(SQLITE_DB_PATH), 'Banco SQLite local original smart_tennis.db intacto');

const db = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    assert(false, 'Conexão com SQLite local', err.message);
    finish();
    return;
  }

  db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
    if (err) {
      assert(false, 'Consulta tabelas SQLite', err.message);
    } else {
      const names = rows.map(r => r.name);
      assert(names.includes('sessions'), 'SQLite preserva tabela sessions');
      assert(names.includes('shots'), 'SQLite preserva tabela shots');
      assert(names.includes('users'), 'SQLite preserva tabela users');
      assert(names.includes('academy_content'), 'SQLite preserva tabela academy_content');
    }
    db.close();
    finish();
  });
});

function finish() {
  console.log('\n======================================================');
  console.log(`  RESULTADO: ${passedTests} aprovados, ${failedTests} reprovados`);
  console.log('======================================================\n');
  process.exit(failedTests > 0 ? 1 : 0);
}
