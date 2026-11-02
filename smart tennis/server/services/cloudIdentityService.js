/**
 * ==============================================================================
 * MOTION TENNIS — SERVIÇO DE IDENTIDADE E AUTENTICAÇÃO CLOUD (ETAPA B)
 * ==============================================================================
 * Conecta e valida identidades do Supabase Auth com o banco SQLite local.
 *
 * PRINCÍPIOS FUNDAMENTAIS:
 * 1. PRESERVAÇÃO TOTAL: Usuários locais, senhas PBKDF2 e sessões existentes
 *    permanecem intactos no SQLite e continuam funcionando normalmente.
 * 2. ZERO SERVICE_ROLE: Nenhuma chave administrativa é utilizada ou exigida.
 * 3. VALIDAÇÃO ESTREITA DE TOKENS: Verificação de expiração, claims (aud='authenticated',
 *    sub=UUID), emissor e assinatura criptográfica (HMAC-SHA256 ou endpoint oficial).
 * 4. ASSOCIAÇÃO 1:1 SEGURA: Um atleta local associa-se a no máximo 1 conta cloud,
 *    e um UUID cloud associa-se a no máximo 1 atleta local.
 * ==============================================================================
 */

const crypto = require('crypto');
const { get, run, all } = require('../database/db');
const {
  getSupabaseConfig,
  isSupabaseConfigured,
  isValidUuid
} = require('../config/supabaseConfig');

/**
 * Decodifica com segurança uma parte Base64URL de um JWT sem lançar exceções.
 */
function decodeBase64UrlJson(str) {
  try {
    if (!str || typeof str !== 'string') return null;
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonStr);
  } catch (err) {
    return null;
  }
}

/**
 * Realiza a validação estrutural e de claims de um token Supabase Auth.
 * Retorna { valid: boolean, payload?: object, error?: string, code?: string }
 */
async function verifySupabaseToken(token, options = {}) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token não fornecido ou em formato inválido.', code: 'INVALID_TOKEN_FORMAT' };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'O token JWT deve conter exatamente 3 segmentos.', code: 'MALFORMED_JWT' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeBase64UrlJson(headerB64);
  const payload = decodeBase64UrlJson(payloadB64);

  if (!header || !payload) {
    return { valid: false, error: 'Falha ao decodificar cabeçalho ou payload do JWT.', code: 'MALFORMED_JWT_PAYLOAD' };
  }

  // 1. Validação de Algoritmo (rejeita ausente, 'none' ou não suportado)
  if (!header.alg || header.alg === 'none' || (header.alg !== 'HS256' && header.alg !== 'RS256' && header.alg !== 'ES256')) {
    return { valid: false, error: `Algoritmo não suportado ou ausente: ${header.alg || 'none'}`, code: 'UNSUPPORTED_ALGORITHM' };
  }

  // 2. Validação da Claim 'sub' (UUID do atleta no Supabase Auth)
  const cloudUserId = payload.sub;
  if (!isValidUuid(cloudUserId)) {
    return { valid: false, error: 'A claim sub deve ser um UUID válido.', code: 'INVALID_SUB_UUID' };
  }

  // 3. Validação da Claim 'aud' (Audiência oficial do Supabase: 'authenticated')
  if (payload.aud !== 'authenticated') {
    return { valid: false, error: "Audiência inválida. Esperado: 'authenticated'.", code: 'INVALID_AUDIENCE' };
  }

  // 4. Validação da Claim 'exp' (Expiração do Token)
  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload.exp || typeof payload.exp !== 'number') {
    return { valid: false, error: 'Token não possui claim de expiração (exp).', code: 'MISSING_EXPIRATION' };
  }
  if (payload.exp <= nowSec) {
    return { valid: false, error: 'Token Supabase Auth expirado.', code: 'TOKEN_EXPIRED' };
  }

  // 5. Validação da Claim 'nbf' (Not Before, se presente)
  if (payload.nbf && typeof payload.nbf === 'number' && payload.nbf > nowSec + 60) {
    return { valid: false, error: 'Token ainda não é válido (nbf futuro).', code: 'TOKEN_NOT_YET_VALID' };
  }

  // 6. Validação da Claim 'iss' (Emissor do Supabase)
  const config = getSupabaseConfig();
  if (config.configured && config.url) {
    const expectedIss = `${config.url}/auth/v1`;
    if (!payload.iss) {
      return { valid: false, error: 'Token não possui claim de emissor (iss).', code: 'MISSING_ISSUER' };
    }
    if (payload.iss !== expectedIss) {
      return { valid: false, error: 'Emissor (iss) do token não corresponde ao projeto configurado.', code: 'INVALID_ISSUER' };
    }
  }

  // 7. Validação Criptográfica de Assinatura (Fail-Closed)
  const jwtSecret = options.jwtSecret || config.jwtSecret;
  if (jwtSecret) {
    if (header.alg !== 'HS256') {
      return { valid: false, error: 'Algoritmo assimétrico incompatível com segredo HMAC configurado.', code: 'ALGORITHM_SECRET_MISMATCH' };
    }
    const dataToSign = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto
      .createHmac('sha256', jwtSecret)
      .update(dataToSign)
      .digest('base64url');

    try {
      const sigBuf = Buffer.from(signatureB64);
      const expBuf = Buffer.from(expectedSig);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return { valid: false, error: 'Assinatura do token Supabase Auth inválida.', code: 'INVALID_SIGNATURE' };
      }
    } catch (e) {
      return { valid: false, error: 'Falha na verificação da assinatura criptográfica.', code: 'SIGNATURE_CHECK_FAILED' };
    }
  } else if (config.configured && config.url && config.anonKey) {
    // Verificação oficial via API REST do Supabase Auth usando a anonKey pública
    try {
      const verifyRes = await fetch(`${config.url}/auth/v1/user`, {
        method: 'GET',
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${token}`
        }
      });

      if (!verifyRes.ok) {
        return { valid: false, error: 'Token rejeitado pelo servidor Supabase Auth.', code: 'REMOTE_AUTH_FAILED' };
      }

      const remoteUser = await verifyRes.json();
      if (!remoteUser || remoteUser.id !== cloudUserId) {
        return { valid: false, error: 'Inconsistência entre payload e identidade remota.', code: 'REMOTE_USER_MISMATCH' };
      }
    } catch (netErr) {
      return {
        valid: false,
        error: 'Não foi possível verificar a assinatura do token Supabase remotamente (servidor offline ou inacessível).',
        code: 'SIGNATURE_VERIFICATION_UNAVAILABLE'
      };
    }
  } else {
    // Sem chave local de verificação e sem Supabase online configurado: FAIL CLOSED
    return {
      valid: false,
      error: 'Assinatura não pôde ser verificada: Supabase não está configurado e nenhum JWT Secret está presente.',
      code: 'VERIFICATION_UNAVAILABLE'
    };
  }

  return {
    valid: true,
    cloudUserId,
    email: payload.email || null,
    payload
  };
}

/**
 * Localiza um usuário local no SQLite através de seu UUID Supabase Auth.
 */
async function getLinkedUserByCloudId(cloudUserId, provider = 'supabase') {
  if (!cloudUserId || !isValidUuid(cloudUserId)) return null;

  const row = await get(
    `SELECT u.id, u.username, u.name, u.role, u.avatar, u.status, u.created_at,
            uci.cloud_user_id, uci.email as cloud_email, uci.linked_at, uci.last_seen_at
     FROM users u
     JOIN user_cloud_identities uci ON uci.user_id = u.id
     WHERE uci.provider = ? AND uci.cloud_user_id = ?
     LIMIT 1`,
    [provider, cloudUserId]
  );

  return row || null;
}

/**
 * Retorna os dados da identidade cloud vinculada a um usuário local.
 */
async function getCloudIdentityForUser(userId, provider = 'supabase') {
  if (!userId) return null;

  const row = await get(
    `SELECT cloud_user_id, email, provider, linked_at, last_seen_at, metadata_json
     FROM user_cloud_identities
     WHERE user_id = ? AND provider = ?
     LIMIT 1`,
    [userId, provider]
  );

  return row || null;
}

/**
 * Associa com segurança um usuário local do SQLite a um UUID do Supabase Auth.
 * Garante unicidade bidirecional (1:1).
 */
async function linkLocalUserToCloud({ userId, cloudUserId, email = null, metadata = null, provider = 'supabase' }) {
  if (!userId || !Number.isInteger(Number(userId))) {
    throw new Error('ID de usuário local inválido.');
  }
  if (!cloudUserId || !isValidUuid(cloudUserId)) {
    throw new Error('ID de usuário cloud (UUID) inválido.');
  }

  // 1. Verifica se o usuário local existe no SQLite
  const localUser = await get('SELECT id, username FROM users WHERE id = ?', [userId]);
  if (!localUser) {
    throw new Error('Usuário local não encontrado no SQLite.');
  }

  // 2. Verifica se este usuário local já está vinculado a outra identidade deste provedor
  const existingForUser = await get(
    'SELECT cloud_user_id FROM user_cloud_identities WHERE user_id = ? AND provider = ?',
    [userId, provider]
  );
  if (existingForUser && existingForUser.cloud_user_id !== cloudUserId) {
    throw new Error(`Este usuário local já está vinculado à identidade cloud ${existingForUser.cloud_user_id}. Desvincule primeiro.`);
  }

  // 3. Verifica se o UUID cloud já está em uso por outro usuário local
  const existingForCloud = await get(
    'SELECT user_id FROM user_cloud_identities WHERE cloud_user_id = ? AND provider = ?',
    [cloudUserId, provider]
  );
  if (existingForCloud && Number(existingForCloud.user_id) !== Number(userId)) {
    throw new Error('Esta conta cloud já está associada a outro atleta neste equipamento.');
  }

  const metaStr = metadata ? JSON.stringify(metadata) : null;

  // 4. Insere ou atualiza o registro na tabela de identidades
  await run(
    `INSERT INTO user_cloud_identities (user_id, provider, cloud_user_id, email, metadata_json, linked_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, provider) DO UPDATE SET
       cloud_user_id = excluded.cloud_user_id,
       email = COALESCE(excluded.email, user_cloud_identities.email),
       metadata_json = COALESCE(excluded.metadata_json, user_cloud_identities.metadata_json),
       last_seen_at = CURRENT_TIMESTAMP`,
    [userId, provider, cloudUserId, email, metaStr]
  );

  // 5. Atualiza a coluna de conveniência em users (se existir)
  try {
    await run('UPDATE users SET supabase_user_id = ? WHERE id = ?', [cloudUserId, userId]);
  } catch (e) {
    // Silencia se a coluna não tiver sido criada ainda
  }

  // 6. ETAPA C: Associa partidas offline que estavam aguardando vinculação (pending_link)
  try {
    const pendingOutbox = await all(
      `SELECT id, payload_json FROM cloud_outbox WHERE user_id = ? AND status = 'pending_link'`,
      [userId]
    );
    for (const ev of pendingOutbox) {
      try {
        const parsed = JSON.parse(ev.payload_json);
        if (parsed && parsed.payload) {
          parsed.payload.user_id = cloudUserId;
        }
        await run(
          `UPDATE cloud_outbox
           SET cloud_user_id = ?, payload_json = ?, status = 'pending', updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [cloudUserId, JSON.stringify(parsed), ev.id]
        );
      } catch (_) {}
    }

    if (pendingOutbox && pendingOutbox.length > 0) {
      try {
        const { triggerSync } = require('./cloudSyncWorker');
        if (typeof triggerSync === 'function') {
          setImmediate(() => triggerSync().catch(() => {}));
        }
      } catch (_) {}
    }
  } catch (_) {}

  return {
    success: true,
    userId,
    cloudUserId,
    email,
    provider
  };
}

/**
 * Remove a associação entre o usuário local e a identidade cloud.
 */
async function unlinkLocalUserFromCloud(userId, provider = 'supabase') {
  if (!userId) return { success: false, error: 'ID de usuário não informado.' };

  await run('DELETE FROM user_cloud_identities WHERE user_id = ? AND provider = ?', [userId, provider]);
  try {
    await run('UPDATE users SET supabase_user_id = NULL WHERE id = ?', [userId]);
  } catch (e) {}

  return { success: true, message: 'Vínculo com Supabase Auth removido com sucesso.' };
}

module.exports = {
  verifySupabaseToken,
  getLinkedUserByCloudId,
  getCloudIdentityForUser,
  linkLocalUserToCloud,
  unlinkLocalUserFromCloud
};
