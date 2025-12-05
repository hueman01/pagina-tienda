// Configuración de la API
const API_BASE_URL = 'https://tienda-api-copia-lzcs.onrender.com/api';
// const API_BASE_URL = 'http://localhost:3000/api';

// Variables globales
let cart = [];
let currentUser = null;
let products = [];
let authToken = localStorage.getItem('token');
let lastPreview = null;
let lastProductSelected = null;
const clpFormatter = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
function formatCLP(value) {
    return clpFormatter.format(Number(value || 0));
}

// Elementos del DOM
const loginLink = document.getElementById('login-link');
const registerLink = document.getElementById('register-link');
const logoutBtn = document.getElementById('logout-btn');
const welcomeMessage = document.getElementById('welcome-message');
const shippingAddressInput = document.getElementById('shipping-address');
const checkoutModal = document.getElementById('checkout-modal');
const checkoutSummary = document.getElementById('checkout-summary');
const checkoutPdf = document.getElementById('checkout-pdf');

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    
    // Verificar si hay un token de autenticación
    if (authToken) {
        try {
            await fetchUserProfile();
            await loadCart();
            loadOrderHistory();
        } catch (error) {
            console.error('Error al cargar datos del usuario:', error);
            logout();
        }
    }
    
    await loadProducts();
    updateUI();
});

// Configurar event listeners
function setupEventListeners() {
    // Formulario de registro
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await registerUser();
    });
    
    // Formulario de login
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await loginUser();
    });
    
    // Botón de logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Barra de búsqueda
    document.getElementById('search-input').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            searchProducts();
        }
    });
}

// Función para cargar productos desde la API
async function loadProducts() {
    try {
        showLoader('product-list');
        const response = await fetch(`${API_BASE_URL}/products`);
        
        if (!response.ok) {
            throw new Error('Error al cargar productos');
        }
        
        const data = await response.json();
        // Aceptar arreglo directo o { items: [...] }
        products = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
        displayProducts(products);
    } catch (error) {
        console.error('Error al cargar productos:', error);
        showError('product-list', 'Error al cargar productos. Por favor intente más tarde.');
    }
}

// Mostrar productos en la página
function displayProducts(productsToDisplay) {
    const productList = document.getElementById('product-list');
    
    if (!productsToDisplay || productsToDisplay.length === 0) {
        productList.innerHTML = '<div class="no-products">No hay productos disponibles</div>';
        return;
    }
    
    productList.innerHTML = '';
    
    productsToDisplay.forEach(product => {
        const productDiv = document.createElement('div');
        productDiv.className = 'product-card';
        const sinStock = typeof product.Stock === 'number' && product.Stock <= 0;
        productDiv.addEventListener('click', () => showProductDetail(product));
        productDiv.innerHTML = `
            <img src="${product.ImagenUrl || 'https://via.placeholder.com/300x200?text=Producto'}" alt="${product.Nombre}">
            <h3>${product.Nombre}</h3>
            <p class="price">${formatCLP(product.Precio)}</p>
            <p class="description">${product.Descripcion || 'Sin descripción disponible'}</p>
            <p class="stock ${sinStock ? 'stock-out' : ''}">${sinStock ? 'Agotado' : `Stock: ${product.Stock ?? 'N/D'}`}</p>
            <button class="btn-primary add-btn" onclick="event.stopPropagation(); addToCart(${product.Id})" ${sinStock ? 'disabled' : ''}>
                <i class="fas fa-cart-plus"></i> ${sinStock ? 'Sin stock' : 'Agregar al Carrito'}
            </button>
        `;
        productList.appendChild(productDiv);
    });
}

// Buscar productos
function searchProducts() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    
    if (!searchTerm) {
        displayProducts(products);
        return;
    }
    
    const filteredProducts = products.filter(product => 
        product.Nombre.toLowerCase().includes(searchTerm) || 
        (product.Descripcion && product.Descripcion.toLowerCase().includes(searchTerm))
    );
    
    displayProducts(filteredProducts);
}

// Funciones del carrito
async function addToCart(productId) {
    if (!currentUser) {
        showModal('loginModal');
        showMessage('Por favor inicie sesión para agregar productos al carrito', 'info');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/cart`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                productId,
                quantity: 1
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al agregar al carrito');
        }
        
        await loadCart();
        showMessage('Producto agregado al carrito', 'success');
    } catch (error) {
        console.error('Error al agregar al carrito:', error);
        showMessage(error.message || 'Error al agregar al carrito', 'error');
    }
}

async function loadCart() {
    if (!currentUser) {
        cart = [];
        updateCartSummary();
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/cart`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar carrito');
        }
        
        const cartItems = await response.json();
        cart = cartItems.map(item => ({
            product: {
                Id: item.ProductoId,
                Nombre: item.Nombre,
                Precio: item.Precio,
                ImagenUrl: item.ImagenUrl
            },
            quantity: item.Cantidad
        }));
        
        updateCartSummary();
        displayCartItems();
    } catch (error) {
        console.error('Error al cargar carrito:', error);
        showMessage('Error al cargar carrito', 'error');
    }
}

function updateCartSummary() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.product.Precio * item.quantity), 0);
    
    document.getElementById('cart-summary').innerHTML = `
        <p>${totalItems} ${totalItems === 1 ? 'producto' : 'productos'}</p>
        <p>Total: ${formatCLP(totalPrice)}</p>
    `;
    const heroTotal = document.getElementById('hero-total');
    if (heroTotal) heroTotal.textContent = `${formatCLP(totalPrice)}`;
    
    // Mostrar/ocultar sección de checkout según si hay items
    document.getElementById('checkout-section').style.display = 
        cart.length > 0 ? 'block' : 'none';
}

function showProductDetail(product) {
    lastProductSelected = product;
    document.getElementById('detail-image').src = product.ImagenUrl || 'https://via.placeholder.com/500x400?text=Producto';
    document.getElementById('detail-title').textContent = product.Nombre;
    document.getElementById('detail-price').textContent = `${formatCLP(product.Precio)}`;
    document.getElementById('detail-description').textContent = product.Descripcion || 'Sin descripción disponible';
    const stockText = typeof product.Stock === 'number' ? `Stock: ${product.Stock}` : 'Stock no disponible';
    document.getElementById('detail-stock').textContent = stockText;
    const addBtn = document.getElementById('detail-add-btn');
    const sinStock = typeof product.Stock === 'number' && product.Stock <= 0;
    addBtn.disabled = sinStock;
    addBtn.innerHTML = sinStock ? 'Sin stock' : '<i class="fas fa-cart-plus"></i> Agregar al Carrito';
    addBtn.onclick = () => {
        if (lastProductSelected) addToCart(lastProductSelected.Id);
    };
    showModal('productModal');
}

function displayCartItems() {
    const cartItemsDiv = document.getElementById('cart-items');
    
    if (cart.length === 0) {
        cartItemsDiv.innerHTML = '<div class="empty-cart">Tu carrito está vacío</div>';
        document.getElementById('cart-total-row').style.display = 'none';
        return;
    }
    
    cartItemsDiv.innerHTML = '';
    
    cart.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item';
        itemDiv.innerHTML = `
            <div class="cart-item-info">
                <h4>${item.product.Nombre}</h4>
                <p>Precio unitario: ${formatCLP(item.product.Precio)}</p>
                <p>Cantidad: ${item.quantity}</p>
                <p>Total: ${formatCLP(item.product.Precio * item.quantity)}</p>
            </div>
            <div class="cart-item-actions">
                <button class="quantity-btn" onclick="updateCartItem(${item.product.Id}, ${item.quantity - 1})">
                    <i class="fas fa-minus"></i>
                </button>
                <span>${item.quantity}</span>
                <button class="quantity-btn" onclick="updateCartItem(${item.product.Id}, ${item.quantity + 1})">
                    <i class="fas fa-plus"></i>
                </button>
                <button class="btn-danger" onclick="removeFromCart(${item.product.Id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        cartItemsDiv.appendChild(itemDiv);
    });
    
    const totalPrice = cart.reduce((sum, item) => sum + (item.product.Precio * item.quantity), 0);
    document.getElementById('cart-total-text').textContent = `Total de la compra: ${formatCLP(totalPrice)}`;
    document.getElementById('cart-items-count').textContent = `${cart.length} ${cart.length === 1 ? 'producto' : 'productos'}`;
    document.getElementById('cart-total-row').style.display = 'flex';
}

async function updateCartItem(productId, quantity) {
    if (quantity < 1) {
        await removeFromCart(productId);
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/cart/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ quantity })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al actualizar carrito');
        }
        
        await loadCart();
    } catch (error) {
        console.error('Error al actualizar carrito:', error);
        showMessage(error.message || 'Error al actualizar carrito', 'error');
    }
}

async function removeFromCart(productId) {
    try {
        const response = await fetch(`${API_BASE_URL}/cart/${productId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al eliminar del carrito');
        }
        
        await loadCart();
        showMessage('Producto eliminado del carrito', 'info');
    } catch (error) {
        console.error('Error al eliminar del carrito:', error);
        showMessage(error.message || 'Error al eliminar del carrito', 'error');
    }
}

// Finalizar compra: previsualizar PDF
async function checkout() {
    if (!currentUser) {
        showModal('loginModal');
        showMessage('Por favor inicie sesión para finalizar la compra', 'info');
        return;
    }
    
    if (cart.length === 0) {
        showMessage('Tu carrito está vacío', 'info');
        return;
    }
    
    const address = shippingAddressInput.value || currentUser.Direccion;
    
    if (!address) {
        showMessage('Por favor ingrese una dirección de envío', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/orders/preview`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                address
            })
        });
        
        if (!response.ok) {
            const error = await parseBodySafe(response);
            throw new Error(error.message || `Error al previsualizar compra (status ${response.status})`);
        }
        
        const data = await response.json();
        lastPreview = { address, pdfBase64: data.pdfBase64, total: data.total, items: data.items };
        renderPreview(data);
        showModal('checkout-modal');
    } catch (error) {
        console.error('Error al previsualizar compra:', error);
        showMessage(error.message || 'Error al previsualizar compra', 'error');
        closeModal('checkout-modal');
    }
}

function renderPreview(data) {
    if (!checkoutSummary || !checkoutPdf) return;
    checkoutSummary.innerHTML = `
        <p><strong>Dirección de envío:</strong> ${data.address}</p>
        <p><strong>Total:</strong> ${formatCLP(data.total)}</p>
        <h4>Productos</h4>
        <ul>
            ${data.items.map(i => `<li>${i.Nombre} x${i.Cantidad} - ${formatCLP(i.Precio)}</li>`).join('')}
        </ul>
    `;
    checkoutPdf.src = `data:application/pdf;base64,${data.pdfBase64}`;
}

function cancelCheckout() {
    closeModal('checkout-modal');
    lastPreview = null;
}

async function confirmCheckout() {
    if (!lastPreview) {
        showMessage('No hay una previsualización activa', 'warning');
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ address: lastPreview.address })
        });
        if (!response.ok) {
            const error = await parseBodySafe(response);
            throw new Error(error.message || `Error al finalizar compra (status ${response.status})`);
        }
        const data = await response.json();
        downloadPdf(data.pdfBase64, `pedido-${data.orderId}.pdf`);
        showMessage(`Compra realizada con éxito. Pedido: ${data.orderId}`, 'success');
        closeModal('checkout-modal');
        lastPreview = null;
        await loadCart();
        loadOrderHistory();
        loadProducts();
        showTab('orders');
    } catch (error) {
        console.error('Error al confirmar compra:', error);
        showMessage(error.message || 'Error al confirmar compra', 'error');
    }
}

function downloadPdf(base64, filename) {
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${base64}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
}

// Funciones de usuario
async function registerUser() {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const address = document.getElementById('regAddress').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                email,
                password,
                address
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error en el registro');
        }
        
        const data = await response.json();
        
        // Guardar token y usuario
        authToken = data.token;
        localStorage.setItem('token', authToken);
        currentUser = data.user;
        
        // Cerrar modal y actualizar UI
        closeModal('registerModal');
        document.getElementById('registerForm').reset();
        updateUI();
        showMessage('Registro exitoso! Bienvenido ' + currentUser.Nombre, 'success');
        
        // Cargar carrito y pedidos
        await loadCart();
        loadOrderHistory();
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        showMessage(error.message || 'Error al registrar usuario', 'error');
    }
}

async function loginUser() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al iniciar sesión');
        }
        
        const data = await response.json();
        
        // Guardar token y usuario
        authToken = data.token;
        localStorage.setItem('token', authToken);
        currentUser = data.user;
        
        // Cerrar modal y actualizar UI
        closeModal('loginModal');
        document.getElementById('loginForm').reset();
        updateUI();
        showMessage(`Bienvenido ${currentUser.Nombre}!`, 'success');
        
        // Cargar carrito y pedidos
        await loadCart();
        loadOrderHistory();
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        showMessage(error.message || 'Error al iniciar sesión', 'error');
    }
}

async function fetchUserProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar perfil');
        }
        
        currentUser = await response.json();
    } catch (error) {
        console.error('Error al obtener perfil:', error);
        throw error;
    }
}

function logout() {
    localStorage.removeItem('token');
    authToken = null;
    currentUser = null;
    cart = [];
    
    updateUI();
    updateCartSummary();
    loadOrderHistory();
    
    // Mostrar pestaña de productos
    showTab('products');
    
    showMessage('Sesión cerrada correctamente', 'info');
}

// Historial de pedidos
async function loadOrderHistory() {
    const orderHistoryDiv = document.getElementById('order-history');
    
    if (!currentUser) {
        orderHistoryDiv.innerHTML = '<div class="login-prompt">Por favor inicie sesión para ver su historial de pedidos</div>';
        return;
    }
    
    try {
        showLoader('order-history');
        
        const response = await fetch(`${API_BASE_URL}/orders/history`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar historial');
        }
        
        const orders = await response.json();
        displayOrderHistory(orders);
    } catch (error) {
        console.error('Error al cargar historial:', error);
        showError('order-history', 'Error al cargar historial de pedidos');
    }
}

function displayOrderHistory(orders) {
    const orderHistoryDiv = document.getElementById('order-history');
    
    if (!orders || orders.length === 0) {
        orderHistoryDiv.innerHTML = '<div class="no-orders">No tienes pedidos anteriores</div>';
        return;
    }
    
    orderHistoryDiv.innerHTML = '';
    
    orders.forEach(order => {
        const orderDiv = document.createElement('div');
        orderDiv.className = 'order-card';
        orderDiv.innerHTML = `
            <h3>Pedido #${order.Id}</h3>
            <p><strong>Fecha:</strong> ${new Date(order.FechaPedido).toLocaleString()}</p>
            <p><strong>Total:</strong> ${formatCLP(order.Total)}</p>
            <p><strong>Estado:</strong> <span class="status-${order.Estado.toLowerCase()}">${order.Estado}</span></p>
            <button class="btn-primary" onclick="showOrderDetails('${order.Id}')">
                <i class="fas fa-info-circle"></i> Ver Detalles
            </button>
            <div id="order-details-${order.Id}" class="order-details" style="display:none;"></div>
        `;
        orderHistoryDiv.appendChild(orderDiv);
    });
}

async function showOrderDetails(orderId) {
    const detailsDiv = document.getElementById(`order-details-${orderId}`);
    
    if (detailsDiv.style.display === 'none') {
        try {
            detailsDiv.innerHTML = '<div class="loader">Cargando detalles...</div>';
            detailsDiv.style.display = 'block';
            
            const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Error al cargar detalles');
            }
            
            const orderDetails = await response.json();
            
            let itemsHtml = '<h4>Productos:</h4><ul class="order-items-list">';
            orderDetails.Items.forEach(item => {
                itemsHtml += `
                    <li>
                        <img src="${item.Productos.ImagenUrl || 'https://via.placeholder.com/80?text=Producto'}" alt="${item.Productos.Nombre}">
                        ${item.Productos.Nombre} - ${formatCLP(item.Precio)} x ${item.Cantidad}
                    </li>
                `;
            });
            itemsHtml += '</ul>';
            detailsDiv.innerHTML = `
                ${itemsHtml}
                <p><strong>Total:</strong> ${formatCLP(orderDetails.Total)}</p>
                <p><strong>Dirección de envío:</strong> ${orderDetails.DireccionEnvio}</p>
            `;
        } catch (error) {
            console.error('Error al cargar detalles del pedido:', error);
            detailsDiv.innerHTML = '<div class="error">Error al cargar detalles del pedido</div>';
        }
    } else {
        detailsDiv.style.display = 'none';
    }
}

// Funciones auxiliares de UI
function updateUI() {
    if (currentUser) {
        welcomeMessage.textContent = `Bienvenido, ${currentUser.Nombre}`;
        logoutBtn.style.display = 'inline-block';
        loginLink.style.display = 'none';
        registerLink.style.display = 'none';
    } else {
        welcomeMessage.textContent = '';
        logoutBtn.style.display = 'none';
        loginLink.style.display = 'inline-block';
        registerLink.style.display = 'inline-block';
    }
}

function showTab(tabId) {
    // Ocultar todas las pestañas
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Mostrar la pestaña seleccionada
    document.getElementById(tabId).classList.add('active');
}

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showLoader(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '<div class="loader">Cargando...</div>';
    }
}

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<div class="error-message">${message}</div>`;
    }
}

function showMessage(message, type) {
    const messageContainer = document.getElementById('message-container');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                       type === 'error' ? 'fa-exclamation-circle' : 
                       type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
        ${message}
    `;
    
    messageContainer.appendChild(messageDiv);
    
    // Eliminar el mensaje después de 3 segundos
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

async function parseBodySafe(response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error('Respuesta no JSON:', text);
        return { message: text || 'Respuesta no valida del servidor' };
    }
}




