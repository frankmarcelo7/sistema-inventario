const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'cambia_este_secreto_en_produccion';
const TOKEN_EXPIRES = process.env.TOKEN_EXPIRES || '8h';

// ── POST /api/auth/login ───────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ ok: false, error: 'Correo y contraseña son requeridos' });
        }

        const result = await pool.query(
            'SELECT * FROM usuarios WHERE email = $1 AND activo = TRUE',
            [email.trim().toLowerCase()]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
        }

        const usuario = result.rows[0];
        const coincide = await bcrypt.compare(password, usuario.password_hash);
        if (!coincide) {
            return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
        }

        const token = jwt.sign(
            { id: usuario.id, email: usuario.email, rol: usuario.rol },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRES }
        );

        res.json({
            ok: true,
            token,
            usuario: {
                id:        usuario.id,
                nombre:    usuario.nombre,
                apellido:  usuario.apellido,
                email:     usuario.email,
                rol:       usuario.rol,
                avatar_url: usuario.avatar_url
            }
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'Error en el servidor' });
    }
});

// ── GET /api/auth/me ───────────────────────────────────────
router.get('/me', verificarToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, nombre, apellido, email, rol, avatar_url FROM usuarios WHERE id = $1 AND activo = TRUE',
            [req.usuario.id]
        );
        if (result.rowCount === 0) {
            return res.status(401).json({ ok: false, error: 'Usuario no válido' });
        }
        res.json({ ok: true, usuario: result.rows[0] });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'Error en el servidor' });
    }
});

// ── Middleware: verificar token JWT ────────────────────────
function verificarToken(req, res, next) {
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ ok: false, error: 'No autenticado' });
    }

    try {
        req.usuario = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
    }
}

module.exports = { router, verificarToken, JWT_SECRET };
