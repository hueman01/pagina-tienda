const API_BASE_URL = 'https://tienda-api-copia-lzcs.onrender.com/api';
// const API_BASE_URL = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
    loadSiteInfo();
});

async function loadSiteInfo() {
    const errorEl = document.getElementById('info-error');
    const updatedEl = document.getElementById('info-updated');
    try {
        const response = await fetch(`${API_BASE_URL}/info`, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        renderField('centroAyuda', data.centroAyuda);
        renderField('preguntasFrecuentes', data.preguntasFrecuentes);
        renderField('terminosCondiciones', data.terminosCondiciones);
        renderField('quienesSomos', data.quienesSomos);
        renderField('beneficiosComprar', data.beneficiosComprar);
        renderField('privacidadSeguridad', data.privacidadSeguridad);
        renderField('consejosTecnologicos', data.consejosTecnologicos);
        renderField('puntosVerdes', data.puntosVerdes);

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

function renderField(fieldKey, value) {
    const el = document.querySelector(`[data-field=\"${fieldKey}\"]`);
    if (!el) return;
    el.textContent = value && value.trim() ? value : 'Contenido no disponible por ahora.';
}
