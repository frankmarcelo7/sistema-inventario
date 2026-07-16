const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/proveedores
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT pr.*, COUNT(p.id) AS total_productos
            FROM proveedores pr
            LEFT JOIN productos p ON p.proveedor_id = pr.id AND p.estado = 'activo'
            WHERE pr.activo = true
            GROUP BY pr.id
            ORDER BY pr.nombre
        `);
        res.json({ ok: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// GET /api/proveedores/:id
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM proveedores WHERE id = $1', [req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ ok: false, error: 'Proveedor no encontrado' });
        res.json({ ok: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// POST /api/proveedores
router.post('/', async (req, res) => {
    try {
        const { nombre, ruc_nit, email, telefono, direccion, ciudad, pais, contacto_nombre, sitio_web } = req.body;
        const result = await pool.query(`
            INSERT INTO proveedores (nombre, ruc_nit, email, telefono, direccion, ciudad, pais, contacto_nombre, sitio_web)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [nombre, ruc_nit, email, telefono, direccion, ciudad, pais || 'Guatemala', contacto_nombre, sitio_web]
        );
        res.status(201).json({ ok: true, data: result.rows[0], message: 'Proveedor creado exitosamente' });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// PUT /api/proveedores/:id
router.put('/:id', async (req, res) => {
    try {
        const { nombre, ruc_nit, email, telefono, direccion, ciudad, pais, contacto_nombre, sitio_web } = req.body;
        const result = await pool.query(`
            UPDATE proveedores SET
              nombre=$1, ruc_nit=$2, email=$3, telefono=$4, direccion=$5,
              ciudad=$6, pais=$7, contacto_nombre=$8, sitio_web=$9
            WHERE id=$10 RETURNING *`,
            [nombre, ruc_nit, email, telefono, direccion, ciudad, pais, contacto_nombre, sitio_web, req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ ok: false, error: 'Proveedor no encontrado' });
        res.json({ ok: true, data: result.rows[0], message: 'Proveedor actualizado' });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// DELETE /api/proveedores/:id (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('UPDATE proveedores SET activo = false WHERE id = $1', [req.params.id]);
        res.json({ ok: true, message: 'Proveedor desactivado' });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
