const p = require('../db');

const hashes = {
  'admin@inventario.com':  '$2b$12$LwxNVAKfxNiFGaFCwiKbueAlN4ws/L/MD7QEHkryvzR3PBCVjCtvO',
  'carlos@inventario.com': '$2b$12$0i1cqc67cnNBTaYJaE0Dz.CIjEMZ0XNntKcf8mIxwLUzDO/2/Fae6',
  'ana@inventario.com':    '$2b$12$F87vXUEArlZPCHz7L1Xi1emUUY4mUqP1gOwfHTlQp72YcU1rw8ndy'
};

(async () => {
  for (const [email, password_hash] of Object.entries(hashes)) {
    const r = await p.query('UPDATE usuarios SET password_hash = $1 WHERE email = $2', [password_hash, email]);
    console.log(`actualizado ${email}: ${r.rowCount} fila(s)`);
  }
  await p.end();
})();
