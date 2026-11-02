const path = require('path');
const s = require(path.join(__dirname, '..', 'node_modules', 'sqlite3'));
const file = process.argv[2] || path.join(__dirname, '..', 'server', 'database', 'smart_tennis.db');
const d = new s.Database(file, s.OPEN_READONLY);
const q = (sql) => new Promise((res, rej) => d.all(sql, (e, r) => (e ? rej(e) : res(r))));
(async () => {
  console.log('DB:', file);
  console.log('system_settings:', JSON.stringify(await q('select key,value,updated_at from system_settings')));
  console.log('users:', JSON.stringify(await q('select id,username,role,status from users')));
  console.log('sessions:', JSON.stringify(await q('select id,user_id,mode,total_score,is_simulation,created_at from sessions order by created_at')));
  console.log('equipments wall:', JSON.stringify(await q('select id,wall_preset,updated_at from equipments')));
  console.log('commercial tables:', JSON.stringify(await q("select name from sqlite_master where name like 'commercial%'")));
  d.close();
})();
