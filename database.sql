-- ============================================================
--   SISTEMA DE GESTIÓN DE INVENTARIO
--   Base de datos PostgreSQL
--   Versión: 1.0
--   Fecha: 2026-07-15
-- ============================================================

-- Eliminar base de datos si existe (opcional, para recrear)
-- DROP DATABASE IF EXISTS inventario_db;
-- CREATE DATABASE inventario_db;

-- ============================================================
-- EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLA: usuarios
-- Almacena los usuarios del sistema (administradores, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id            SERIAL PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    apellido      VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol           VARCHAR(30)  NOT NULL DEFAULT 'operador'
                  CHECK (rol IN ('admin', 'operador', 'supervisor')),
    telefono      VARCHAR(20),
    avatar_url    TEXT,
    activo        BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en     TIMESTAMP    NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMP   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE usuarios IS 'Usuarios del sistema de inventario';

-- ============================================================
-- TABLA: categorias
-- Clasificación de los productos
-- ============================================================
CREATE TABLE IF NOT EXISTS categorias (
    id            SERIAL PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL UNIQUE,
    descripcion   TEXT,
    color         VARCHAR(7)   DEFAULT '#4318FF',
    icono         VARCHAR(50),
    activo        BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en     TIMESTAMP    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE categorias IS 'Categorías de productos (Electrónica, Mobiliario, etc.)';

-- ============================================================
-- TABLA: proveedores
-- ============================================================
CREATE TABLE IF NOT EXISTS proveedores (
    id             SERIAL PRIMARY KEY,
    nombre         VARCHAR(150) NOT NULL,
    ruc_nit        VARCHAR(30)  UNIQUE,
    email          VARCHAR(150),
    telefono       VARCHAR(30),
    direccion      TEXT,
    ciudad         VARCHAR(100),
    pais           VARCHAR(100) DEFAULT 'Guatemala',
    contacto_nombre VARCHAR(100),
    sitio_web      VARCHAR(200),
    activo         BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en      TIMESTAMP    NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMP    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE proveedores IS 'Proveedores que suministran los productos';

-- ============================================================
-- TABLA: productos
-- ============================================================
CREATE TABLE IF NOT EXISTS productos (
    id              SERIAL PRIMARY KEY,
    sku             VARCHAR(50)    NOT NULL UNIQUE,
    nombre          VARCHAR(200)   NOT NULL,
    descripcion     TEXT,
    categoria_id    INTEGER        REFERENCES categorias(id) ON DELETE SET NULL,
    proveedor_id    INTEGER        REFERENCES proveedores(id) ON DELETE SET NULL,
    precio_compra   NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    precio_venta    NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    stock_actual    INTEGER        NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo    INTEGER        NOT NULL DEFAULT 5,
    stock_maximo    INTEGER        NOT NULL DEFAULT 500,
    unidad_medida   VARCHAR(30)    DEFAULT 'unidad',
    ubicacion       VARCHAR(100),
    imagen_url      TEXT,
    estado          VARCHAR(20)    NOT NULL DEFAULT 'activo'
                    CHECK (estado IN ('activo', 'inactivo', 'descontinuado')),
    creado_en       TIMESTAMP      NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMP      NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE productos IS 'Catálogo de todos los productos del inventario';

-- ============================================================
-- TABLA: movimientos_inventario
-- ============================================================
CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id              SERIAL PRIMARY KEY,
    codigo          VARCHAR(20)    NOT NULL UNIQUE,
    producto_id     INTEGER        NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    tipo            VARCHAR(10)    NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
    cantidad        INTEGER        NOT NULL CHECK (cantidad > 0),
    stock_anterior  INTEGER        NOT NULL,
    stock_nuevo     INTEGER        NOT NULL,
    precio_unitario NUMERIC(12, 2),
    motivo          TEXT,
    usuario_id      INTEGER        REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_movimiento TIMESTAMP     NOT NULL DEFAULT NOW(),
    creado_en       TIMESTAMP      NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE movimientos_inventario IS 'Historial de entradas, salidas y ajustes de stock';

-- ============================================================
-- TABLA: alertas
-- ============================================================
CREATE TABLE IF NOT EXISTS alertas (
    id           SERIAL PRIMARY KEY,
    producto_id  INTEGER      REFERENCES productos(id) ON DELETE CASCADE,
    tipo         VARCHAR(30)  NOT NULL CHECK (tipo IN ('stock_critico', 'stock_bajo', 'sin_stock', 'otro')),
    mensaje      TEXT         NOT NULL,
    leida        BOOLEAN      NOT NULL DEFAULT FALSE,
    creado_en    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_productos_sku         ON productos(sku);
CREATE INDEX IF NOT EXISTS idx_productos_categoria   ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_proveedor   ON productos(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_productos_estado      ON productos(estado);
CREATE INDEX IF NOT EXISTS idx_movimientos_producto  ON movimientos_inventario(producto_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo      ON movimientos_inventario(tipo);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha     ON movimientos_inventario(fecha_movimiento DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_leida         ON alertas(leida);

-- ============================================================
-- FUNCIÓN & TRIGGER: actualizar timestamp automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuarios_updated
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trg_proveedores_updated
    BEFORE UPDATE ON proveedores
    FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trg_productos_updated
    BEFORE UPDATE ON productos
    FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- ============================================================
-- FUNCIÓN & TRIGGER: generar código de movimiento automático
-- ============================================================
CREATE OR REPLACE FUNCTION generar_codigo_movimiento()
RETURNS TRIGGER AS $$
DECLARE
    ultimo_id INTEGER;
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO ultimo_id FROM movimientos_inventario;
    NEW.codigo = 'MOV-' || LPAD((ultimo_id + 1)::TEXT, 5, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_movimiento_codigo
    BEFORE INSERT ON movimientos_inventario
    FOR EACH ROW EXECUTE FUNCTION generar_codigo_movimiento();

-- ============================================================
-- FUNCIÓN & TRIGGER: actualizar stock al registrar movimiento
-- ============================================================
CREATE OR REPLACE FUNCTION actualizar_stock()
RETURNS TRIGGER AS $$
DECLARE
    stock_prev INTEGER;
BEGIN
    SELECT stock_actual INTO stock_prev FROM productos WHERE id = NEW.producto_id;
    NEW.stock_anterior = stock_prev;

    IF NEW.tipo = 'entrada' THEN
        NEW.stock_nuevo = stock_prev + NEW.cantidad;
    ELSIF NEW.tipo = 'salida' THEN
        IF stock_prev < NEW.cantidad THEN
            RAISE EXCEPTION 'Stock insuficiente. Disponible: %, Solicitado: %', stock_prev, NEW.cantidad;
        END IF;
        NEW.stock_nuevo = stock_prev - NEW.cantidad;
    ELSIF NEW.tipo = 'ajuste' THEN
        NEW.stock_nuevo = NEW.cantidad;
    END IF;

    UPDATE productos SET stock_actual = NEW.stock_nuevo WHERE id = NEW.producto_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_actualizar_stock
    BEFORE INSERT ON movimientos_inventario
    FOR EACH ROW EXECUTE FUNCTION actualizar_stock();

-- ============================================================
-- FUNCIÓN & TRIGGER: generar alerta cuando stock cae bajo mínimo
-- ============================================================
CREATE OR REPLACE FUNCTION generar_alerta_stock()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM alertas WHERE producto_id = NEW.id AND tipo IN ('stock_critico', 'stock_bajo', 'sin_stock');

    IF NEW.stock_actual = 0 THEN
        INSERT INTO alertas (producto_id, tipo, mensaje)
        VALUES (NEW.id, 'sin_stock',
                'SIN STOCK: "' || NEW.nombre || '" tiene 0 unidades disponibles.');
    ELSIF NEW.stock_actual <= (NEW.stock_minimo / 2) THEN
        INSERT INTO alertas (producto_id, tipo, mensaje)
        VALUES (NEW.id, 'stock_critico',
                'CRÍTICO: "' || NEW.nombre || '" tiene solo ' || NEW.stock_actual || ' unidades.');
    ELSIF NEW.stock_actual <= NEW.stock_minimo THEN
        INSERT INTO alertas (producto_id, tipo, mensaje)
        VALUES (NEW.id, 'stock_bajo',
                'STOCK BAJO: "' || NEW.nombre || '" está por debajo del mínimo (' || NEW.stock_minimo || ').');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alerta_stock
    AFTER UPDATE OF stock_actual ON productos
    FOR EACH ROW EXECUTE FUNCTION generar_alerta_stock();

-- ============================================================
-- VISTAS
-- ============================================================

-- Productos con categoría, proveedor y estado de stock
CREATE OR REPLACE VIEW v_productos AS
SELECT
    p.id, p.sku, p.nombre, p.descripcion,
    c.nombre        AS categoria,
    pr.nombre       AS proveedor,
    p.precio_compra, p.precio_venta,
    p.stock_actual, p.stock_minimo,
    p.unidad_medida, p.ubicacion, p.estado,
    CASE
        WHEN p.stock_actual = 0                        THEN 'Sin Stock'
        WHEN p.stock_actual <= p.stock_minimo / 2      THEN 'Stock Crítico'
        WHEN p.stock_actual <= p.stock_minimo          THEN 'Stock Bajo'
        ELSE 'Disponible'
    END AS estado_stock,
    p.creado_en
FROM productos p
LEFT JOIN categorias  c  ON p.categoria_id  = c.id
LEFT JOIN proveedores pr ON p.proveedor_id  = pr.id;

-- Resumen por categoría
CREATE OR REPLACE VIEW v_inventario_por_categoria AS
SELECT
    c.nombre                                        AS categoria,
    COUNT(p.id)                                     AS total_productos,
    SUM(p.stock_actual)                             AS total_stock,
    SUM(p.stock_actual * p.precio_compra)           AS valor_inventario,
    SUM(p.stock_actual * p.precio_venta)            AS valor_venta_potencial
FROM categorias c
LEFT JOIN productos p ON p.categoria_id = c.id AND p.estado = 'activo'
GROUP BY c.id, c.nombre
ORDER BY total_stock DESC;

-- Historial de movimientos con detalle
CREATE OR REPLACE VIEW v_movimientos AS
SELECT
    m.id, m.codigo, m.fecha_movimiento,
    p.nombre AS producto, p.sku,
    m.tipo, m.cantidad, m.stock_anterior, m.stock_nuevo,
    m.precio_unitario, m.motivo,
    u.nombre || ' ' || u.apellido AS responsable
FROM movimientos_inventario m
JOIN productos p ON m.producto_id = p.id
LEFT JOIN usuarios u ON m.usuario_id = u.id
ORDER BY m.fecha_movimiento DESC;

-- ============================================================
-- DATOS DE EJEMPLO (SEED DATA)
-- ============================================================

INSERT INTO usuarios (nombre, apellido, email, password_hash, rol) VALUES
('Admin',   'Sistema',   'admin@inventario.com',   '$2b$12$hashAdmin',   'admin'),
('Carlos',  'Ruiz',      'carlos@inventario.com',  '$2b$12$hashCarlos',  'operador'),
('Ana',     'Martínez',  'ana@inventario.com',     '$2b$12$hashAna',     'supervisor')
ON CONFLICT (email) DO NOTHING;

INSERT INTO categorias (nombre, descripcion, color, icono) VALUES
('Electrónica',  'Equipos y dispositivos electrónicos',    '#4318FF', 'bi-cpu'),
('Mobiliario',   'Muebles y accesorios de oficina',        '#05CD99', 'bi-chair'),
('Oficina',      'Suministros y papelería de oficina',     '#FFCE20', 'bi-pen'),
('Herramientas', 'Herramientas manuales y eléctricas',     '#FF6B6B', 'bi-tools')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO proveedores (nombre, ruc_nit, email, telefono, ciudad, pais, contacto_nombre) VALUES
('Dell Inc.',           '1234567890', 'ventas@dell.com',          '+1-800-624-9897',  'Round Rock', 'Estados Unidos', 'John Smith'),
('LG Electronics',      '0987654321', 'business@lg.com',          '+82-2-3777-1114',  'Seúl',       'Corea del Sur',  'Kim Joon'),
('Herman Miller',       '1122334455', 'orders@hermanmiller.com',  '+1-888-443-4357',  'Zeeland',    'Estados Unidos', 'Sarah Johnson'),
('Logitech',            '5544332211', 'sales@logitech.com',       '+41-21-863-5111',  'Lausana',    'Suiza',          'Pierre Dupont'),
('Distribuidora Local', '9876543210', 'info@distriblocal.com',    '+502-2222-3333',   'Guatemala',  'Guatemala',      'Pedro García')
ON CONFLICT DO NOTHING;

INSERT INTO productos (sku, nombre, descripcion, categoria_id, proveedor_id, precio_compra, precio_venta, stock_actual, stock_minimo, stock_maximo, ubicacion) VALUES
('PROD-001', 'Laptop Dell XPS 15',             'Intel Core i7, 16GB RAM, 512GB SSD, 15.6" 4K',          1, 1,  950.00, 1299.00, 45,  5,  100, 'Estante A-01'),
('PROD-002', 'Monitor LG 27" 4K',              'Monitor 4K UHD, panel IPS, 60Hz, HDR10',                1, 2,  250.00,  349.50,  2,  5,   50, 'Estante A-02'),
('PROD-003', 'Silla Ergonómica Herman Miller', 'Silla profesional con soporte lumbar ajustable',         2, 3,  600.00,  850.00, 15,  5,   30, 'Bodega B-01'),
('PROD-004', 'Mouse Inalámbrico Logitech MX',  'Mouse ergonómico 4000 DPI, conexión USB-C',             1, 4,   45.00,   79.99, 80, 10,  200, 'Estante A-03'),
('PROD-005', 'Teclado Mecánico Logitech G915', 'Teclado mecánico inalámbrico GL Tactile, retroiluminado',1, 4, 100.00,  149.99, 35, 10,  100, 'Estante A-04'),
('PROD-006', 'Escritorio Regulable en Altura', 'Escritorio eléctrico ajustable 140x70cm',                2, 5,  400.00,  589.00,  8,  3,   20, 'Bodega B-02'),
('PROD-007', 'Papel Carta Resma 500 hojas',    'Papel bond blanco 75g/m², tamaño carta',                3, 5,    4.50,    8.99,200, 20,  500, 'Estante C-01'),
('PROD-008', 'Audífonos Sony WH-1000XM5',      'Cancelación de ruido activa, 30h batería',              1, 5,  220.00,  329.99,  0,  5,   50, 'Estante A-05')
ON CONFLICT (sku) DO NOTHING;

-- ============================================================
-- CONSULTAS DE REFERENCIA RÁPIDA
-- ============================================================
-- Ver todos los productos:
--   SELECT * FROM v_productos ORDER BY estado_stock, nombre;
--
-- Productos con stock bajo:
--   SELECT * FROM v_productos WHERE estado_stock IN ('Sin Stock','Stock Crítico','Stock Bajo');
--
-- Valor total del inventario:
--   SELECT SUM(stock_actual * precio_compra) AS valor_total FROM productos WHERE estado = 'activo';
--
-- Historial de un producto:
--   SELECT * FROM v_movimientos WHERE sku = 'PROD-001';
--
-- Alertas no leídas:
--   SELECT a.*, p.nombre FROM alertas a JOIN productos p ON a.producto_id = p.id WHERE a.leida = FALSE;
--
-- Inventario por categoría:
--   SELECT * FROM v_inventario_por_categoria;
-- ============================================================
