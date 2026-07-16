// ================================================================
//  Sistema de Gestión de Inventario - Utilidades de Autenticación
// ================================================================

const AUTH = {
    TOKEN_KEY: 'inv_token',
    USER_KEY:  'inv_user',

    getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    },

    getUser() {
        const raw = localStorage.getItem(this.USER_KEY);
        return raw ? JSON.parse(raw) : null;
    },

    setSession(token, usuario) {
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(usuario));
    },

    logout() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        window.location.href = 'index.html';
    },

    isAuthenticated() {
        return !!this.getToken();
    },

    // Redirige a login si no hay sesión. Usar en páginas protegidas.
    guard() {
        if (!this.isAuthenticated()) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    },

    // Adjunta el token a un fetch
    header() {
        const token = this.getToken();
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }
};
