const API_BASE_URL = 'https://tienda-api-copia-lzcs.onrender.com/api';
// const API_BASE_URL = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
    cacheDefaults();
    loadSiteInfo();
});

function cacheDefaults() {
    document.querySelectorAll('[data-field]').forEach(el => {
        el.dataset.defaultContent = el.innerHTML;
    });
}

async function loadSiteInfo() {
    const errorEl = document.getElementById('info-error');
    const updatedEl = document.getElementById('info-updated');

    try {
        const response = await fetch(`${API_BASE_URL}/info`, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        renderAllFields(data);

        const updatedAt = data.updatedAt || data.createdAt;
        if (updatedAt && updatedEl) {
            const d = new Date(updatedAt);
            updatedEl.textContent = `Última actualización: ${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
        }
        if (errorEl) errorEl.textContent = '';
    } catch (err) {
        console.error('No se pudo cargar la información del sitio', err);
        if (errorEl) errorEl.textContent = 'No se pudo cargar la información. Intenta más tarde.';
    }
}

function renderAllFields(data) {
    document.querySelectorAll('[data-field]').forEach(el => {
        const key = el.dataset.field;
        const value = data && typeof data[key] === 'string' ? data[key] : '';
        const fallback = el.dataset.defaultContent || '';
        const hasValue = value.trim().length > 0;
        el.innerHTML = hasValue ? value : fallback;
    });
}
