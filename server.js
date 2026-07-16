require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// ── Rutas API ──────────────────────────────────────────────
const { router: authRouter, verificarToken } = require('./routes/auth');
app.use('/api/auth', authRouter);

app.use('/api/dashboard',   require('./routes/dashboard'));
app.use('/api/productos',   verificarToken, require('./routes/productos'));
app.use('/api/categorias',  verificarToken, require('./routes/categorias'));
app.use('/api/proveedores', verificarToken, require('./routes/proveedores'));
app.use('/api/movimientos', verificarToken, require('./routes/movimientos'));

// ── Ruta de salud ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ ok: true, message: 'API funcionando correctamente', timestamp: new Date() });
});

// ── Manejo de errores 404 ──────────────────────────────────
app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ ok: false, error: `Ruta ${req.path} no encontrada` });
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Iniciar servidor ───────────────────────────────────────
app.listen(PORT, () => {
    console.log('');
    console.log('🚀 =====================================================');
    console.log(`🚀  Sistema de Inventario - API corriendo`);
    console.log(`🚀  URL: http://localhost:${PORT}`);
    console.log(`🚀  API: http://localhost:${PORT}/api/health`);
    console.log('🚀 =====================================================');
    console.log('');
});
