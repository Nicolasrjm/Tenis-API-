const { verifyPassword } = require('../server/services/authService');
const { get } = require('../server/database/db');

async function test() {
  const nic = await get("SELECT * FROM users WHERE username = 'nicolas'");
  console.log('NICOLAS_LOGIN_TEST:', verifyPassword('nicolas123', nic.password_hash, nic.salt));

  const adm = await get("SELECT * FROM users WHERE username = 'admin'");
  console.log('ADMIN_LOGIN_TEST:', verifyPassword('admin123', adm.password_hash, adm.salt));
  process.exit(0);
}

test();
