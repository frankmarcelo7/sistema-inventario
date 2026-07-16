const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/productos - Listar todos
router.get('/', async (req, res) => {
    try {
        const { categoria, estado, search } = req.query;
        let query = `SELECT * FROM v_productos WHERE 1=1`;
        const params = [];

        if (categoria) {
            params.push(categoria);
            query += ` AND categoria = $${params.length}`;
        }
        if (estado) {
            params.push(estado);
            query += ` AND estado_stock = $${params.length}`;
        }
        if (search) {
            params.push(`%${search}%`);
            query += ` AND (nombre ILIKE $${params.length} OR sku ILIKE $${params.length})`;
        }
        query += ` ORDER BY nombre`;

        const result = await pool.query(query, params);
        res.json({ ok: true, data: result.rows, total: result.rowCount });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// GET /api/productos/:id - Obtener uno
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM v_productos WHERE id = $1', [req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ ok: false, error: 'Producto no encontrado' });
        res.json({ ok: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// POST /api/productos - Crear nuevo
router.post('/', async (req, res) => {
    try {
        const { sku, nombre, descripcion, categoria_id, proveedor_id,
                precio_compra, precio_venta, stock_actual, stock_minimo,
                stock_maximo, unidad_medida, ubicacion } = req.body;

        const result = await pool.query(`
            INSERT INTO productos
              (sku, nombre, descripcion, categoria_id, proveedor_id,
               precio_compra, precio_venta, stock_actual, stock_minimo,
               stock_maximo, unidad_medida, ubicacion)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            RETURNING *`,
            [sku, nombre, descripcion, categoria_id, proveedor_id,
             precio_compra, precio_venta, stock_actual || 0, stock_minimo || 5,
             stock_maximo || 500, unidad_medida || 'unidad', ubicacion]
        );
        res.status(201).json({ ok: true, data: result.rows[0], message: 'Producto creado exitosamente' });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ ok: false, error: 'El SKU ya existe' });
        res.status(500).json({ ok: false, error: err.message });
    }
});

// PUT /api/productos/:id - Actualizar
router.put('/:id', async (req, res) => {
    try {
        const { nombre, descripcion, categoria_id, proveedor_id,
                precio_compra, precio_venta, stock_minimo, stock_maximo,
                unidad_medida, ubicacion, estado } = req.body;

        const result = await pool.query(`
            UPDATE productos SET
              nombre=$1, descripcion=$2, categoria_id=$3, proveedor_id=$4,
              precio_compra=$5, precio_venta=$6, stock_minimo=$7, stock_maximo=$8,
              unidad_medida=$9, ubicacion=$10, estado=$11
            WHERE id=$12 RETURNING *`,
            [nombre, descripcion, categoria_id, proveedor_id,
             precio_compra, precio_venta, stock_minimo, stock_maximo,
             unidad_medida, ubicacion, estado, req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ ok: false, error: 'Producto no encontrado' });
        res.json({ ok: true, data: result.rows[0], message: 'Producto actualizado' });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// DELETE /api/productos/:id - Eliminar
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM productos WHERE id = $1 RETURNING nombre', [req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ ok: false, error: 'Producto no encontrado' });
        res.json({ ok: true, message: `Producto "${result.rows[0].nombre}" eliminado` });
    } catch (err) {
        if (err.code === '23503') return res.status(409).json({ ok: false, error: 'No se puede eliminar, tiene movimientos asociados' });
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
