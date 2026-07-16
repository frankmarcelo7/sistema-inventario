const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/movimientos - Historial con filtros
router.get('/', async (req, res) => {
    try {
        const { tipo, fecha, producto_id } = req.query;
        let query = `SELECT * FROM v_movimientos WHERE 1=1`;
        const params = [];

        if (tipo) {
            params.push(tipo);
            query += ` AND tipo = $${params.length}`;
        }
        if (fecha) {
            params.push(fecha);
            query += ` AND DATE(fecha_movimiento) = $${params.length}`;
        }
        if (producto_id) {
            params.push(producto_id);
            query += ` AND id IN (SELECT id FROM movimientos_inventario WHERE producto_id = $${params.length})`;
        }
        query += ` ORDER BY fecha_movimiento DESC LIMIT 100`;

        const result = await pool.query(query, params);
        res.json({ ok: true, data: result.rows, total: result.rowCount });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// POST /api/movimientos - Registrar entrada o salida
router.post('/', async (req, res) => {
    try {
        const { producto_id, tipo, cantidad, motivo, usuario_id, precio_unitario } = req.body;

        if (!producto_id || !tipo || !cantidad) {
            return res.status(400).json({ ok: false, error: 'producto_id, tipo y cantidad son requeridos' });
        }

        // El trigger actualizar_stock calculará stock_anterior, stock_nuevo y actualizará productos
        const result = await pool.query(`
            INSERT INTO movimientos_inventario
              (codigo, producto_id, tipo, cantidad, stock_anterior, stock_nuevo, precio_unitario, motivo, usuario_id)
            VALUES ('TMP', $1, $2, $3, 0, 0, $4, $5, $6)
            RETURNING *`,
            [producto_id, tipo, cantidad, precio_unitario || null, motivo || null, usuario_id || 1]
        );

        // Obtener el movimiento con datos completos
        const detalle = await pool.query(
            'SELECT * FROM v_movimientos WHERE id = $1', [result.rows[0].id]
        );

        res.status(201).json({
            ok: true,
            data: detalle.rows[0],
            message: `${tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada: ${cantidad} unidades`
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
