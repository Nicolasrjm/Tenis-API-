// Remove SOMENTE as sessões de teste criadas por execuções acidentais de test_admin_reports_complete.js
// contra o banco real (ids exatos). Faz backup antes e verifica o resultado.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, '..', 'node_modules', 'sqlite3'));

const DB = path.join(__dirname, '..', 'server', 'database', 'smart_tennis.db');
const IDS = ['sess_1793168624833', 'sess_1793168624841', 'sess_1793169475854', 'sess_1793169475862'];
const BACKUP = path.join(__dirname, '..', 'server', 'database', 'smart_tennis_backup_pre_cleanup_20261028.db');

fs.copyFileSync(DB, BACKUP);
console.log('Backup:', BACKUP);

const db = new sqlite3.Database(DB);
const all = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
const run = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, function (e) { e ? rej(e) : res(this.changes); }));

(async () => {
  const marks = IDS.map(() => '?').join(',');
  const before = await all(`SELECT id,user_id,mode,total_score,created_at FROM sessions WHERE id IN (${marks})`, IDS);
  console.log('Linhas alvo encontradas:', before.length);
  const others = await all(`SELECT COUNT(*) n FROM sessions WHERE id NOT IN (${marks})`, IDS);
  console.log('Outras sessões (não serão tocadas):', others[0].n);
  const changes = await run(`DELETE FROM sessions WHERE id IN (${marks})`, IDS);
  console.log('Linhas removidas:', changes);
  console.log('Sessões restantes:', (await all('SELECT COUNT(*) n FROM sessions'))[0].n);
  db.close();
})();
