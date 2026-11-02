import { openDB } from 'idb';

const DB_NAME = 'smart_tennis_offline_db';
const DB_VERSION = 1;

/**
 * Inicializa e gerencia o banco de dados IndexedDB local do aplicativo móvel.
 * Cada registro é estritamente segregado pelo identificador real do atleta (userId).
 */
export async function getOfflineDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // 1. Perfil do jogador (keyPath: userId)
      if (!db.objectStoreNames.contains('profiles')) {
        db.createObjectStore('profiles', { keyPath: 'userId' });
      }

      // 2. Partidas e sessões (keyPath: id, index: userId)
      if (!db.objectStoreNames.contains('sessions')) {
        const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
        sessionStore.createIndex('by_user', 'userId');
      }

      // 3. Atributos e evolução (keyPath: [userId, key], index: userId)
      if (!db.objectStoreNames.contains('attributes')) {
        const attrStore = db.createObjectStore('attributes', { keyPath: ['userId', 'key'] });
        attrStore.createIndex('by_user', 'userId');
      }

      // 4. Conquistas (keyPath: [userId, id], index: userId)
      if (!db.objectStoreNames.contains('achievements')) {
        const achStore = db.createObjectStore('achievements', { keyPath: ['userId', 'id'] });
        achStore.createIndex('by_user', 'userId');
      }

      // 5. Histórico de impactos para mapa de calor (keyPath: [userId, id], index: userId)
      if (!db.objectStoreNames.contains('shots')) {
        const shotStore = db.createObjectStore('shots', { keyPath: ['userId', 'id'] });
        shotStore.createIndex('by_user', 'userId');
      }

      // 6. Metadados de sincronização (keyPath: userId)
      if (!db.objectStoreNames.contains('sync_metadata')) {
        db.createObjectStore('sync_metadata', { keyPath: 'userId' });
      }
    }
  });
}

/**
 * Salva atomicamente em lote o snapshot sincronizado de um atleta no IndexedDB.
 * Isolamento total por userId em transação segura.
 */
export async function savePlayerSnapshot(userId, snapshot) {
  if (!userId) throw new Error('userId obrigatório para salvar snapshot local.');
  const db = await getOfflineDb();
  const tx = db.transaction(
    ['profiles', 'sessions', 'attributes', 'achievements', 'shots', 'sync_metadata'],
    'readwrite'
  );

  try {
    const numUserId = Number(userId);

    // 1. Salva perfil do atleta
    if (snapshot.profile) {
      await tx.objectStore('profiles').put({
        ...snapshot.profile,
        userId: numUserId,
        cachedAt: new Date().toISOString()
      });
    }

    // 2. Salva sessões (partidas finalizadas)
    if (Array.isArray(snapshot.sessions)) {
      // Limpa sessões antigas deste usuário no cache para evitar dados orfãos
      const sessionStore = tx.objectStore('sessions');
      const userIndex = sessionStore.index('by_user');
      let cursor = await userIndex.openCursor(IDBKeyRange.only(numUserId));
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }

      // Insere as sessões recebidas do servidor
      for (const sess of snapshot.sessions) {
        await sessionStore.put({
          ...sess,
          userId: numUserId
        });
      }
    }

    // 3. Salva os atributos do atleta
    if (Array.isArray(snapshot.attributes)) {
      const attrStore = tx.objectStore('attributes');
      const userIndex = attrStore.index('by_user');
      let cursor = await userIndex.openCursor(IDBKeyRange.only(numUserId));
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }

      for (const attr of snapshot.attributes) {
        await attrStore.put({
          ...attr,
          userId: numUserId
        });
      }
    }

    // 4. Salva conquistas do atleta
    if (Array.isArray(snapshot.achievements)) {
      const achStore = tx.objectStore('achievements');
      const userIndex = achStore.index('by_user');
      let cursor = await userIndex.openCursor(IDBKeyRange.only(numUserId));
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }

      for (const ach of snapshot.achievements) {
        await achStore.put({
          ...ach,
          userId: numUserId
        });
      }
    }

    // 5. Salva dados de arremessos / mapa de calor
    if (snapshot.hitmap && Array.isArray(snapshot.hitmap.shots)) {
      const shotStore = tx.objectStore('shots');
      const userIndex = shotStore.index('by_user');
      let cursor = await userIndex.openCursor(IDBKeyRange.only(numUserId));
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }

      for (const shot of snapshot.hitmap.shots) {
        await shotStore.put({
          ...shot,
          userId: numUserId
        });
      }
    }

    // 6. Atualiza metadados da última sincronização bem-sucedida
    const syncTime = new Date().toISOString();
    await tx.objectStore('sync_metadata').put({
      userId: numUserId,
      lastSyncAt: syncTime,
      totalSessions: snapshot.sessions?.length || 0,
      status: 'success'
    });

    await tx.done;
    return { success: true, lastSyncAt: syncTime };
  } catch (err) {
    tx.abort();
    throw err;
  }
}

/**
 * Recupera todos os dados offline sincronizados exclusivamente para o atleta com userId informado.
 * Garante que dados de outro jogador NUNCA sejam retornados.
 */
export async function getPlayerOfflineData(userId) {
  if (!userId) return null;
  const numUserId = Number(userId);
  const db = await getOfflineDb();

  const profile = await db.get('profiles', numUserId);
  const meta = await db.get('sync_metadata', numUserId);

  // Se não existir perfil em cache para este usuário
  if (!profile && !meta) {
    return null;
  }

  // Consulta sessões isoladas por índice by_user
  const sessions = await db.getAllFromIndex('sessions', 'by_user', numUserId);

  // Consulta atributos isolados
  const attributes = await db.getAllFromIndex('attributes', 'by_user', numUserId);

  // Consulta conquistas isoladas
  const achievements = await db.getAllFromIndex('achievements', 'by_user', numUserId);

  // Consulta shots do mapa de calor
  const shots = await db.getAllFromIndex('shots', 'by_user', numUserId);

  // Reconstrói estatísticas e zoneDistribution para o mapa de calor
  const zoneDistribution = {};
  let totalHits = 0;
  let bullseyes = 0;
  for (const s of shots) {
    if (s.zone) {
      zoneDistribution[s.zone] = (zoneDistribution[s.zone] || 0) + 1;
    }
    if (s.is_hit) totalHits++;
    if (s.is_bullseye) bullseyes++;
  }

  const hitmap = {
    shots,
    totalCount: shots.length,
    totalHits,
    bullseyes,
    zoneDistribution
  };

  return {
    userId: numUserId,
    profile,
    sessions,
    attributes,
    achievements,
    hitmap,
    meta: meta || { lastSyncAt: null }
  };
}

/**
 * Consulta a data e status da última sincronização de um atleta.
 */
export async function getSyncMetadata(userId) {
  if (!userId) return null;
  const db = await getOfflineDb();
  return await db.get('sync_metadata', Number(userId));
}

/**
 * Limpa com segurança o cache local de um usuário específico ao deslogar ou trocar de conta.
 */
export async function purgeUserOfflineCache(userId) {
  if (!userId) return;
  const numUserId = Number(userId);
  const db = await getOfflineDb();
  const tx = db.transaction(
    ['profiles', 'sessions', 'attributes', 'achievements', 'shots', 'sync_metadata'],
    'readwrite'
  );

  await tx.objectStore('profiles').delete(numUserId);
  await tx.objectStore('sync_metadata').delete(numUserId);

  const clearStore = async (storeName) => {
    const store = tx.objectStore(storeName);
    const index = store.index('by_user');
    let cursor = await index.openCursor(IDBKeyRange.only(numUserId));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
  };

  await clearStore('sessions');
  await clearStore('attributes');
  await clearStore('achievements');
  await clearStore('shots');

  await tx.done;
}
