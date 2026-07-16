const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/dashboard/stats - KPIs generales
router.get('/stats', async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM productos WHERE estado = 'activo')                     AS total_productos,
                (SELECT COALESCE(SUM(stock_actual), 0) FROM productos WHERE estado = 'activo') AS total_stock,
                (SELECT COUNT(*) FROM productos WHERE stock_actual = 0)                      AS agotados,
                (SELECT COUNT(*) FROM categorias WHERE activo = true)                        AS total_categorias,
                (SELECT COUNT(*) FROM proveedores WHERE activo = true)                       AS total_proveedores,
                (SELECT COUNT(*) FROM alertas WHERE leida = false)                           AS alertas_pendientes,
                (SELECT COALESCE(SUM(stock_actual * precio_compra), 0)
                 FROM productos WHERE estado = 'activo')                                     AS valor_inventario
        `);
        res.json({ ok: true, data: stats.rows[0] });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// GET /api/dashboard/alertas - Alertas no leídas
router.get('/alertas', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT a.id, a.tipo, a.mensaje, a.creado_en,
                   p.nombre AS producto, p.stock_actual, p.stock_minimo
            FROM alertas a
            JOIN productos p ON a.producto_id = p.id
            WHERE a.leida = false
            ORDER BY a.creado_en DESC
        `);
        res.json({ ok: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// GET /api/dashboard/movimientos-recientes
router.get('/movimientos-recientes', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT m.codigo, m.tipo, m.cantidad, m.fecha_movimiento, m.motivo,
                   p.nombre AS producto, p.sku,
                   u.nombre || ' ' || u.apellido AS responsable
            FROM movimientos_inventario m
            JOIN productos p ON m.producto_id = p.id
            LEFT JOIN usuarios u ON m.usuario_id = u.id
            ORDER BY m.fecha_movimiento DESC
            LIMIT 5
        `);
        res.json({ ok: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// PUT /api/dashboard/alertas/:id/leer - Marcar alerta como leída
router.put('/alertas/:id/leer', async (req, res) => {
    try {
        await pool.query('UPDATE alertas SET leida = true WHERE id = $1', [req.params.id]);
        res.json({ ok: true, message: 'Alerta marcada como leída' });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
