// ================================================================
//  Sistema de Gestión de Inventario - Frontend API Client
//  Conectado a: http://localhost:3000/api
// ================================================================

const API = 'http://localhost:3000/api';

// Fetch autenticado (adjunta el JWT si existe)
async function apiFetch(url, options = {}) {
    options.headers = { ...(options.headers || {}), ...(typeof AUTH !== 'undefined' ? AUTH.header() : {}) };
    const res = await fetch(url, options);
    if (res.status === 401 && typeof AUTH !== 'undefined') {
        AUTH.logout();
        throw new Error('Sesión expirada');
    }
    return res;
}

// ── Utilidades ───────────────────────────────────────────────────

function formatCurrency(val) {
    return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'USD' }).format(val || 0);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-GT', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function estadoBadge(estado) {
    const map = {
        'Disponible':    '<span class="badge bg-success bg-opacity-10 text-success">Disponible</span>',
        'Stock Bajo':    '<span class="badge bg-warning bg-opacity-10 text-warning">Stock Bajo</span>',
        'Stock Crítico': '<span class="badge bg-danger bg-opacity-10 text-danger">Stock Crítico</span>',
        'Sin Stock':     '<span class="badge bg-secondary bg-opacity-10 text-secondary">Sin Stock</span>',
    };
    return map[estado] || `<span class="badge bg-secondary">${estado}</span>`;
}

function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} position-fixed bottom-0 end-0 m-3 shadow`;
    toast.style.cssText = 'z-index:9999;min-width:260px;animation:fadeIn .3s';
    toast.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-circle'} me-2"></i>${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// ── DASHBOARD ────────────────────────────────────────────────────

async function cargarDashboard() {
    if (!document.getElementById('kpi-total-productos')) return;

    try {
        // KPIs
        const { data } = await apiFetch(`${API}/dashboard/stats`).then(r => r.json());
        document.getElementById('kpi-total-productos').textContent = Number(data.total_productos).toLocaleString();
        document.getElementById('kpi-total-stock').textContent     = Number(data.total_stock).toLocaleString();
        document.getElementById('kpi-agotados').textContent        = Number(data.agotados).toLocaleString();
        document.getElementById('kpi-categorias').textContent      = Number(data.total_categorias).toLocaleString();

        // Alertas en campana
        const alertCount = Number(data.alertas_pendientes);
        const badgeEl = document.getElementById('alerta-badge');
        if (badgeEl) badgeEl.textContent = alertCount > 0 ? alertCount : '';

        // Movimientos recientes
        const movRes = await apiFetch(`${API}/dashboard/movimientos-recientes`).then(r => r.json());
        const tbody = document.getElementById('tabla-movimientos-recientes');
        if (tbody && movRes.data.length > 0) {
            tbody.innerHTML = movRes.data.map(m => `
                <tr>
                    <td class="text-muted fw-semibold">${m.codigo}</td>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="bg-light p-2 rounded me-3">
                                <i class="bi bi-box text-primary"></i>
                            </div>
                            <span class="fw-semibold">${m.producto}</span>
                        </div>
                    </td>
                    <td>${m.tipo === 'entrada'
                        ? '<span class="badge bg-success">Entrada</span>'
                        : '<span class="badge bg-danger">Salida</span>'}</td>
                    <td class="${m.tipo === 'entrada' ? 'text-success' : 'text-danger'} fw-bold">
                        ${m.tipo === 'entrada' ? '+' : '-'}${m.cantidad}
                    </td>
                    <td class="text-muted">${formatDate(m.fecha_movimiento)}</td>
                    <td><span class="badge bg-success bg-opacity-10 text-success">Completado</span></td>
                </tr>
            `).join('');
        } else if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Sin movimientos recientes</td></tr>';
        }

        // Alertas dropdown
        const alertRes = await apiFetch(`${API}/dashboard/alertas`).then(r => r.json());
        const alertList = document.getElementById('alertas-lista');
        if (alertList && alertRes.data.length > 0) {
            alertList.innerHTML = alertRes.data.map(a => `
                <li>
                    <a class="dropdown-item py-2" href="#" onclick="marcarAlertaLeida(${a.id})">
                        <i class="bi bi-exclamation-circle text-warning me-2"></i>
                        <small>${a.mensaje}</small>
                    </a>
                </li>
            `).join('');
        }

    } catch (err) {
        console.warn('⚠️ No se pudo conectar con la API. Usando datos de ejemplo.', err.message);
    }
}

async function marcarAlertaLeida(id) {
    await apiFetch(`${API}/dashboard/alertas/${id}/leer`, { method: 'PUT' });
    cargarDashboard();
}

// ── PRODUCTOS ────────────────────────────────────────────────────

async function cargarProductos() {
    const tbody = document.getElementById('tabla-productos');
    if (!tbody) return;

    try {
        const search   = document.getElementById('buscar-producto')?.value || '';
        const categoria = document.getElementById('filtro-categoria')?.value || '';
        const params   = new URLSearchParams();
        if (search)    params.append('search', search);
        if (categoria) params.append('categoria', categoria);

        const { data } = await apiFetch(`${API}/productos?${params}`).then(r => r.json());

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-5">No se encontraron productos</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(p => `
            <tr>
                <td class="text-muted fw-semibold">#${p.sku}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="bg-light p-2 rounded me-3">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(p.nombre.substring(0,2))}&background=6AD2FF&color=fff&size=32" class="rounded">
                        </div>
                        <div>
                            <h6 class="mb-0 fw-semibold">${p.nombre}</h6>
                            <small class="text-muted">${p.proveedor || '-'}</small>
                        </div>
                    </div>
                </td>
                <td>${p.categoria || '-'}</td>
                <td>${formatCurrency(p.precio_venta)}</td>
                <td><span class="fw-bold ${p.stock_actual <= p.stock_minimo ? 'text-danger' : ''}">${p.stock_actual}</span> ud.</td>
                <td>${estadoBadge(p.estado_stock)}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-light text-primary me-1" onclick="editarProducto(${p.id})" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-light text-danger" onclick="eliminarProducto(${p.id}, '${p.nombre.replace(/'/g, "\\'")}')" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        const counter = document.getElementById('productos-contador');
        if (counter) counter.textContent = `Mostrando ${data.length} producto(s)`;

    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-5"><i class="bi bi-wifi-off me-2"></i>Sin conexión con el servidor</td></tr>';
    }
}

async function guardarProducto() {
    const id = document.getElementById('producto-id')?.value;
    const body = {
        sku:           document.getElementById('producto-sku')?.value,
        nombre:        document.getElementById('producto-nombre')?.value,
        categoria_id:  document.getElementById('producto-categoria')?.value,
        proveedor_id:  document.getElementById('producto-proveedor')?.value,
        precio_compra: document.getElementById('producto-precio-compra')?.value,
        precio_venta:  document.getElementById('producto-precio-venta')?.value,
        stock_actual:  document.getElementById('producto-stock')?.value,
        descripcion:   document.getElementById('producto-descripcion')?.value,
    };

    try {
        const url    = id ? `${API}/productos/${id}` : `${API}/productos`;
        const method = id ? 'PUT' : 'POST';
        const res    = await apiFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        showToast(data.message || 'Producto guardado');
        bootstrap.Modal.getInstance(document.getElementById('productModal'))?.hide();
        cargarProductos();
        cargarSelectores();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

async function editarProducto(id) {
    try {
        const { data } = await apiFetch(`${API}/productos/${id}`).then(r => r.json());
        document.getElementById('producto-id').value              = data.id;
        document.getElementById('producto-sku').value             = data.sku;
        document.getElementById('producto-nombre').value          = data.nombre;
        document.getElementById('producto-descripcion').value     = data.descripcion || '';
        document.getElementById('producto-precio-compra').value   = data.precio_compra;
        document.getElementById('producto-precio-venta').value    = data.precio_venta;
        document.getElementById('producto-stock').value           = data.stock_actual;
        new bootstrap.Modal(document.getElementById('productModal')).show();
    } catch (err) {
        showToast('Error al cargar producto', 'danger');
    }
}

async function eliminarProducto(id, nombre) {
    if (!confirm(`¿Eliminar el producto "${nombre}"?`)) return;
    try {
        const res  = await apiFetch(`${API}/productos/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        showToast(data.message);
        cargarProductos();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

// ── PROVEEDORES ──────────────────────────────────────────────────

async function cargarProveedores() {
    const container = document.getElementById('proveedores-grid');
    if (!container) return;

    try {
        const { data } = await apiFetch(`${API}/proveedores`).then(r => r.json());
        const colors = ['0d6efd','dc3545','198754','fd7e14','6f42c1','20c997'];

        container.innerHTML = data.map((p, i) => `
            <div class="col-12 col-md-6 col-xl-4">
                <div class="card p-4 h-100">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div class="d-flex align-items-center">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(p.nombre.substring(0,2))}&background=${colors[i % colors.length]}&color=fff&rounded=true&size=48" class="me-3">
                            <div>
                                <h6 class="mb-0 fw-bold">${p.nombre}</h6>
                                <small class="text-muted">${p.ciudad || ''}, ${p.pais || ''}</small>
                            </div>
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-light border-0" data-bs-toggle="dropdown">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                            <ul class="dropdown-menu shadow-sm border-0">
                                <li><a class="dropdown-item text-danger" href="#" onclick="eliminarProveedor(${p.id}, '${p.nombre.replace(/'/g, "\\'")}')">
                                    <i class="bi bi-trash me-2"></i>Eliminar</a></li>
                            </ul>
                        </div>
                    </div>
                    <ul class="list-unstyled mb-0 small text-muted">
                        <li class="mb-2"><i class="bi bi-telephone me-2"></i>${p.telefono || 'Sin teléfono'}</li>
                        <li class="mb-2"><i class="bi bi-envelope me-2"></i>${p.email || 'Sin correo'}</li>
                        <li class="mb-2"><i class="bi bi-geo-alt me-2"></i>${p.direccion || p.ciudad || 'Sin dirección'}</li>
                        <li><i class="bi bi-box me-2"></i><strong>${p.total_productos}</strong> productos asociados</li>
                    </ul>
                </div>
            </div>
        `).join('');

    } catch (err) {
        container.innerHTML = '<div class="col-12 text-center text-danger py-5"><i class="bi bi-wifi-off me-2"></i>Sin conexión con el servidor</div>';
    }
}

async function guardarProveedor() {
    const body = {
        nombre:          document.getElementById('prov-nombre')?.value,
        email:           document.getElementById('prov-email')?.value,
        telefono:        document.getElementById('prov-telefono')?.value,
        direccion:       document.getElementById('prov-direccion')?.value,
        ciudad:          document.getElementById('prov-ciudad')?.value,
        pais:            document.getElementById('prov-pais')?.value || 'Guatemala',
        contacto_nombre: document.getElementById('prov-contacto')?.value,
    };
    try {
        const res  = await apiFetch(`${API}/proveedores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        showToast('Proveedor creado exitosamente');
        bootstrap.Modal.getInstance(document.getElementById('supplierModal'))?.hide();
        cargarProveedores();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

async function eliminarProveedor(id, nombre) {
    if (!confirm(`¿Desactivar el proveedor "${nombre}"?`)) return;
    const res  = await apiFetch(`${API}/proveedores/${id}`, { method: 'DELETE' });
    const data = await res.json();
    showToast(data.message);
    cargarProveedores();
}

// ── MOVIMIENTOS ──────────────────────────────────────────────────

async function cargarMovimientos() {
    const tbody = document.getElementById('tabla-movimientos');
    if (!tbody) return;

    try {
        const tipo  = document.getElementById('filtro-tipo')?.value || '';
        const fecha = document.getElementById('filtro-fecha')?.value || '';
        const params = new URLSearchParams();
        if (tipo)  params.append('tipo', tipo);
        if (fecha) params.append('fecha', fecha);

        const { data } = await apiFetch(`${API}/movimientos?${params}`).then(r => r.json());

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-5">Sin movimientos registrados</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(m => `
            <tr>
                <td class="text-muted fw-semibold">${m.codigo}</td>
                <td>${formatDate(m.fecha_movimiento)}</td>
                <td><span class="fw-semibold">${m.producto}</span></td>
                <td>${m.tipo === 'entrada'
                    ? '<span class="badge bg-success bg-opacity-10 text-success"><i class="bi bi-arrow-down-left"></i> Entrada</span>'
                    : '<span class="badge bg-danger bg-opacity-10 text-danger"><i class="bi bi-arrow-up-right"></i> Salida</span>'}</td>
                <td class="fw-bold ${m.tipo === 'entrada' ? 'text-success' : 'text-danger'}">
                    ${m.tipo === 'entrada' ? '+' : '-'}${m.cantidad}
                </td>
                <td>${m.responsable || 'Sistema'}</td>
                <td class="text-muted small">${m.motivo || '-'}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-5"><i class="bi bi-wifi-off me-2"></i>Sin conexión con el servidor</td></tr>';
    }
}

async function guardarMovimiento() {
    const body = {
        producto_id: document.getElementById('mov-producto')?.value,
        tipo:        document.querySelector('input[name="movType"]:checked')?.id === 'typeIn' ? 'entrada' : 'salida',
        cantidad:    parseInt(document.getElementById('mov-cantidad')?.value),
        motivo:      document.getElementById('mov-motivo')?.value,
        usuario_id:  1
    };
    try {
        const res  = await apiFetch(`${API}/movimientos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        showToast(data.message || 'Movimiento registrado');
        bootstrap.Modal.getInstance(document.getElementById('movementModal'))?.hide();
        cargarMovimientos();
        cargarSelectores();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

// ── CATEGORÍAS ───────────────────────────────────────────────────

async function cargarCategorias() {
    const container = document.getElementById('categorias-grid');
    if (!container) return;

    try {
        const { data } = await apiFetch(`${API}/categorias`).then(r => r.json());
        container.innerHTML = data.map(c => `
            <div class="col-12 col-md-6 col-xl-3">
                <div class="card p-4 h-100 text-center">
                    <div class="mx-auto mb-3 rounded-circle d-flex align-items-center justify-content-center"
                         style="width:64px;height:64px;background:${c.color}22">
                        <i class="bi ${c.icono || 'bi-tag'} fs-3" style="color:${c.color}"></i>
                    </div>
                    <h6 class="fw-bold mb-1">${c.nombre}</h6>
                    <p class="text-muted small mb-2">${c.descripcion || ''}</p>
                    <span class="badge bg-primary bg-opacity-10 text-primary">${c.total_productos} productos</span>
                </div>
            </div>
        `).join('');
    } catch (err) {
        if (container) container.innerHTML = '<div class="col-12 text-center text-danger py-5">Sin conexión con el servidor</div>';
    }
}

// ── SELECTORES DINÁMICOS ─────────────────────────────────────────

async function cargarSelectores() {
    try {
        const [catRes, provRes, prodRes] = await Promise.all([
            apiFetch(`${API}/categorias`).then(r => r.json()),
            apiFetch(`${API}/proveedores`).then(r => r.json()),
            apiFetch(`${API}/productos`).then(r => r.json()),
        ]);

        // Selectores de categoría
        document.querySelectorAll('.select-categoria').forEach(sel => {
            const val = sel.value;
            sel.innerHTML = '<option value="">Todas las Categorías</option>' +
                catRes.data.map(c => `<option value="${c.nombre}" ${val===c.nombre?'selected':''}>${c.nombre}</option>`).join('');
        });

        // Selectores de proveedor en modal producto
        document.querySelectorAll('.select-proveedor').forEach(sel => {
            sel.innerHTML = '<option value="">Seleccionar...</option>' +
                provRes.data.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
        });

        // Selector de producto en movimientos
        document.querySelectorAll('.select-producto').forEach(sel => {
            sel.innerHTML = '<option value="">Seleccionar producto...</option>' +
                prodRes.data.map(p => `<option value="${p.id}">${p.nombre} (Stock: ${p.stock_actual})</option>`).join('');
        });

    } catch (err) {
        console.warn('No se pudieron cargar los selectores:', err.message);
    }
}

// ── CHARTS ───────────────────────────────────────────────────────

const initCharts = async () => {
    if (typeof Chart === 'undefined') return;

    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#A3AED1';
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(43,54,116,0.9)';
    Chart.defaults.plugins.tooltip.titleColor = '#FFF';
    Chart.defaults.plugins.tooltip.bodyColor   = '#FFF';
    Chart.defaults.plugins.tooltip.padding     = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.displayColors = false;

    // Salidas Chart
    const salesCtx = document.getElementById('salesChart');
    if (salesCtx) {
        new Chart(salesCtx, {
            type: 'line',
            data: {
                labels: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago'],
                datasets: [{
                    label: 'Salidas de Inventario',
                    data: [65,59,80,81,56,95,110,130],
                    borderColor: '#4318FF',
                    backgroundColor: 'rgba(67,24,255,0.1)',
                    borderWidth: 3, tension: 0.4, fill: true,
                    pointBackgroundColor: '#FFF', pointBorderColor: '#4318FF',
                    pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, grid: { color: '#E2E8F0' } }, x: { grid: { display: false } } } }
        });
    }

    // Categorías Chart - datos reales
    const catCtx = document.getElementById('categoryChart');
    if (catCtx) {
        try {
            const { data } = await apiFetch(`${API}/categorias`).then(r => r.json());
            new Chart(catCtx, {
                type: 'doughnut',
                data: {
                    labels: data.map(c => c.nombre),
                    datasets: [{ data: data.map(c => c.total_productos),
                        backgroundColor: ['#4318FF','#6AD2FF','#05CD99','#FFCE20','#FF6B6B'],
                        borderWidth: 0, hoverOffset: 4 }]
                },
                options: { responsive: true, maintainAspectRatio: false, cutout: '75%',
                    plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } } } }
            });
        } catch (e) { /* usa datos de ejemplo */ }
    }

    // Stock Chart - datos reales
    const stockCtx = document.getElementById('stockChart');
    if (stockCtx) {
        try {
            const { data } = await apiFetch(`${API}/productos`).then(r => r.json());
            const top5 = data.sort((a, b) => b.stock_actual - a.stock_actual).slice(0, 5);
            new Chart(stockCtx, {
                type: 'bar',
                data: {
                    labels: top5.map(p => p.nombre.substring(0, 15) + '...'),
                    datasets: [{ label: 'Stock Actual', data: top5.map(p => p.stock_actual),
                        backgroundColor: '#4318FF', borderRadius: 6, barThickness: 15 }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, grid: { color: '#E2E8F0' } }, x: { grid: { display: false } } } }
            });
        } catch (e) { /* usa datos de ejemplo */ }
    }
};

// ── INICIALIZACIÓN ───────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    // Proteger página: redirigir a login si no hay sesión
    if (typeof AUTH !== 'undefined' && !AUTH.guard()) return;

    // Logout: limpiar sesión en cualquier enlace de "Cerrar Sesión"
    document.querySelectorAll('a[href="index.html"]').forEach(a => {
        a.addEventListener('click', (e) => {
            if (typeof AUTH !== 'undefined') { e.preventDefault(); AUTH.logout(); }
        });
    });

    // Inicializar tooltips de Bootstrap
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el));

    // Cargar datos según la página actual
    await cargarSelectores();
    await cargarDashboard();
    await cargarProductos();
    await cargarProveedores();
    await cargarMovimientos();
    await cargarCategorias();
    await initCharts();

    // Botones de guardar
    document.getElementById('btn-guardar-producto')?.addEventListener('click', guardarProducto);
    document.getElementById('btn-guardar-proveedor')?.addEventListener('click', guardarProveedor);
    document.getElementById('btn-guardar-movimiento')?.addEventListener('click', guardarMovimiento);

    // Búsqueda y filtros en tiempo real
    document.getElementById('buscar-producto')?.addEventListener('input', () => cargarProductos());
    document.getElementById('filtro-categoria')?.addEventListener('change', () => cargarProductos());
    document.getElementById('filtro-tipo')?.addEventListener('change', () => cargarMovimientos());
    document.getElementById('filtro-fecha')?.addEventListener('change', () => cargarMovimientos());

    // Limpiar modal al abrirlo para nuevo producto
    document.getElementById('productModal')?.addEventListener('show.bs.modal', (e) => {
        if (!e.relatedTarget) return; // si se abrió desde código (editar), no limpiar
        document.getElementById('producto-id').value = '';
        document.getElementById('producto-sku').value = '';
        document.getElementById('producto-nombre').value = '';
        document.getElementById('producto-descripcion').value = '';
    });
});


