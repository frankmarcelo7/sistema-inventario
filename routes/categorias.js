const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/categorias
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.*, COUNT(p.id) AS total_productos
            FROM categorias c
            LEFT JOIN productos p ON p.categoria_id = c.id AND p.estado = 'activo'
            WHERE c.activo = true
            GROUP BY c.id
            ORDER BY c.nombre
        `);
        res.json({ ok: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// POST /api/categorias
router.post('/', async (req, res) => {
    try {
        const { nombre, descripcion, color, icono } = req.body;
        const result = await pool.query(
            `INSERT INTO categorias (nombre, descripcion, color, icono)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [nombre, descripcion, color || '#4318FF', icono || 'bi-tag']
        );
        res.status(201).json({ ok: true, data: result.rows[0], message: 'Categoría creada' });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ ok: false, error: 'La categoría ya existe' });
        res.status(500).json({ ok: false, error: err.message });
    }
});

// PUT /api/categorias/:id
router.put('/:id', async (req, res) => {
    try {
        const { nombre, descripcion, color, icono } = req.body;
        const result = await pool.query(
            `UPDATE categorias SET nombre=$1, descripcion=$2, color=$3, icono=$4
             WHERE id=$5 RETURNING *`,
            [nombre, descripcion, color, icono, req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ ok: false, error: 'Categoría no encontrada' });
        res.json({ ok: true, data: result.rows[0], message: 'Categoría actualizada' });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// DELETE /api/categorias/:id
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('UPDATE categorias SET activo = false WHERE id = $1', [req.params.id]);
        res.json({ ok: true, message: 'Categoría desactivada' });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
