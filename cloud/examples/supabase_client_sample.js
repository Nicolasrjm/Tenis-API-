/**
 * ==============================================================================
 * MOTION TENNIS — CLIENTE SUPABASE DE EXEMPLO COM AUTENTICAÇÃO POR EQUIPAMENTO
 * ==============================================================================
 * Demonstra a integração segura entre o ecossistema Motion Tennis e a nuvem:
 * 1. Visitante/Atleta: Consulta o catálogo público gratuito da Academy via chave anon.
 * 2. Atleta Autenticado: Acessa seu próprio perfil e histórico com RLS ativo.
 * 3. Notebook da Quadra: Sincroniza partidas e telemetria chamando RPCs seguras
 *    com sua chave individual revogável (NÃO utiliza service_role!).
 *
 * NUNCA insira chaves reais neste arquivo. Defina as variáveis no seu .env.local.
 * ==============================================================================
 */

const { createClient } = require('@supabase/supabase-js');

// 1. Configurações Públicas e do Equipamento (da quadra)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://seu-projeto.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sua-chave-publica-anon';

// Credenciais individuais do notebook (geradas pelo administrador e revogáveis individualmente)
const EQUIPMENT_ID = process.env.EQUIPMENT_ID || '00000000-0000-0000-0000-000000000000';
const EQUIPMENT_API_KEY = process.env.EQUIPMENT_API_KEY || 'mt_eq_live_exemplo_chave_individual';

// 2. Cliente Padrão (utilizado pelo Notebook e pelo App Mobile)
const publicClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

/**
 * Exemplo 1: Consulta pública do catálogo da Academy
 * Apenas aulas com is_published = true e status = 'published' são retornadas.
 */
async function fetchPublishedAcademyLessons() {
  console.log('\n--- 1. CONSULTA PÚBLICA DA ACADEMY (ANON / RLS) ---');
  const { data, error } = await publicClient
    .from('academy_lessons')
    .select('id, module_key, category, title, duration, embed_url')
    .eq('is_published', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Erro ao consultar Academy:', error.message);
    return;
  }
  console.log(`Catálogo carregado: ${data.length} aulas públicas disponíveis.`);
}

/**
 * Exemplo 2: Atleta autenticado consulta suas próprias partidas
 */
async function fetchAthleteSessions(athleteJwtToken) {
  console.log('\n--- 2. CONSULTA DO HISTÓRICO DO ATLETA (RLS ATIVO) ---');
  const athleteClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${athleteJwtToken}`
      }
    }
  });

  const { data, error } = await athleteClient
    .from('synced_sessions')
    .select('id, mode, shots_count, hits_count, accuracy, total_score, started_at')
    .order('started_at', { ascending: false });

  if (error) {
    console.error('Erro ao consultar sessões:', error.message);
    return;
  }
  console.log(`Histórico carregado: ${data.length} partidas retornadas para o atleta.`);
}

/**
 * Exemplo 3: Notebook envia telemetria (Heartbeat de 60s) sem service_role
 */
async function sendEquipmentHeartbeat(metrics = {}) {
  console.log('\n--- 3. ENVIO DE TELEMETRIA POR RPC DO EQUIPAMENTO ---');
  const { data, error } = await publicClient.rpc('record_equipment_heartbeat_v1', {
    p_equipment_id: EQUIPMENT_ID,
    p_api_key: EQUIPMENT_API_KEY,
    p_heartbeat: {
      client_ip: metrics.client_ip || '127.0.0.1',
      ping_ms: metrics.ping_ms || 42,
      pending_outbox_count: metrics.pending_outbox_count || 0,
      db_integrity_ok: true,
      app_version: '2.4.0'
    }
  });

  if (error) {
    console.error('Falha no heartbeat:', error.message);
    return;
  }
  console.log('Resposta do Heartbeat:', data);
}

/**
 * Exemplo 4: Notebook sincroniza partida finalizada chamando RPC segura (Idempotente)
 */
async function syncSessionViaEquipmentRpc(outboxEvent) {
  console.log('\n--- 4. SINCRONIZAÇÃO ATÔMICA DA PARTIDA VIA RPC SEGURA ---');
  const { data, error } = await publicClient.rpc('sync_equipment_session_v1', {
    p_equipment_id: EQUIPMENT_ID,
    p_api_key: EQUIPMENT_API_KEY,
    p_event: outboxEvent
  });

  if (error) {
    console.error('Erro na sincronização da partida:', error.message);
    return;
  }

  if (data.idempotent) {
    console.log(`Partida já havia sido processada anteriormente (${data.status}). Nenhuma duplicação ocorrida.`);
  } else {
    console.log(`Sucesso: Partida sincronizada com ID: ${data.session_id}`);
  }
}

module.exports = {
  publicClient,
  fetchPublishedAcademyLessons,
  fetchAthleteSessions,
  sendEquipmentHeartbeat,
  syncSessionViaEquipmentRpc
};
