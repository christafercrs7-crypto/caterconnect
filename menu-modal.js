window.currentSelectedCaterer = null;

// 1. Helper functions (Included locally so the modal never breaks)
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return unsafe.toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function getCatererValue(caterer, key) {
    if (!caterer) return null;
    return caterer[key] !== undefined ? caterer[key] : null;
}

// 2. Inject Large Magazine-Style Layout
function injectMenuModalHTML() {
    const modalHTML = `
        <div id="menuModal" class="modal-backdrop hide fixed inset-0 bg-black/80 flex items-center justify-center p-4 md:p-8 backdrop-blur-sm z-50">
            <div class="modal-container bg-white w-full max-w-6xl h-[95vh] rounded-[2rem] overflow-hidden shadow-2xl flex flex-col">
                
                <!-- Header Actions -->
                <div class="px-6 py-4 flex justify-end items-center bg-white absolute top-0 right-0 z-20">
                    <button id="closeModalBtn" class="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors shadow-sm">
                        <i class="fa-solid fa-xmark text-xl"></i>
                    </button>
                </div>
                
                <!-- Body (Scrollable Menu Content) -->
                <div id="modalMenuContent" class="px-6 md:px-12 py-10 overflow-y-auto flex-grow bg-white relative">
                    <!-- Dynamic Menu Injected Here -->
                </div>
                
                <!-- Footer Booking Bar -->
                <div class="p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-between z-20">
                    <div class="flex items-center gap-6">
                        <div class="flex flex-col">
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Guests</span>
                            <input type="number" id="guestCountInput" class="w-20 px-3 py-2 border border-gray-200 rounded-lg text-center text-base font-bold text-gray-700 focus:outline-none focus:border-orange-500" value="30" min="1">
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Est. Total</span>
                            <span id="estimatedTotalPrice" class="text-2xl font-black text-orange-600 leading-none">$0</span>
                        </div>
                    </div>
                    <a id="whatsappBookingBtn" href="#" target="_blank" class="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-green-500/30 transition-all transform hover:scale-105 active:scale-95">
                        <i class="fa-brands fa-whatsapp text-xl"></i>
                        <span>Discuss Menu on WhatsApp</span>
                    </a>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    setupModalEventListeners();
}

window.openMenuModal = function(caterer) {
    window.currentSelectedCaterer = caterer;

    const modal = document.getElementById('menuModal');
    const bodyEl = document.getElementById('modalMenuContent');
    const guestInput = document.getElementById('guestCountInput');

    if (!modal) return;

    const minGuests = getCatererValue(caterer, 'min_guests') || 20;
    if (guestInput) {
        guestInput.value = minGuests;
        guestInput.min = minGuests;
    }

    bodyEl.innerHTML = renderMenuHTML(caterer);
    updateModalPriceAndWhatsAppLink();
    
    modal.classList.remove('hide');
    document.body.style.overflow = 'hidden';
};

function renderMenuHTML(caterer) {
    const catererName = getCatererValue(caterer, 'name') || 'Caterer';
    let specData = getCatererValue(caterer, 'specifications');
    
    if (Array.isArray(specData) && specData.length > 0) {
        specData = specData[0];
    } else if (!specData) {
        specData = {};
    }

    const description = specData.description || getCatererValue(caterer, 'description') || 'Custom event menu available upon inquiry.';
    const categories = specData.categories || [];
    
    if (categories.length === 0) {
        return `
            <div class="text-center py-20 text-gray-400 h-full flex flex-col justify-center items-center">
                <i class="fa-solid fa-utensils text-6xl mb-4 block text-gray-200"></i>
                <p class="text-lg font-medium">Standard custom event menu available upon inquiry.</p>
            </div>
        `;
    }

    let html = `
        <div class="mb-8 mt-4">
            <h3 class="text-xs font-bold text-blue-900 uppercase tracking-widest mb-1">${escapeHtml(catererName)}</h3>
            <h2 class="text-4xl md:text-5xl font-black text-blue-900 uppercase tracking-tight mb-4">OUR MENU</h2>
            <p class="menu-intro-text max-w-4xl">${escapeHtml(description)}</p>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-10">
    `;

    categories.forEach(category => {
        const catName = category.category_name || 'Category';
        const imageUrl = category.image_url || 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%25%22%20height%3D%22100%25%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23e2e8f0%22%2F%3E%3C%2Fsvg%3E';
        const items = category.items || [];

        html += `
            <div class="menu-category-card">
                <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(catName)}" class="menu-category-img" loading="lazy">
                <div class="menu-category-title">${escapeHtml(catName)}</div>
                <ul class="menu-items-grid">
        `;
        
        items.forEach(item => {
            const itemName = typeof item === 'object' ? (item.name || 'Item') : item;
            html += `<li class="menu-item-li">${escapeHtml(itemName)}</li>`;
        });

        html += `
                </ul>
            </div>
        `;
    });

    html += `</div>`; 
    return html;
}

window.updateModalPriceAndWhatsAppLink = function() {
    if (!window.currentSelectedCaterer) return;

    const guestInput = document.getElementById('guestCountInput');
    const totalPriceEl = document.getElementById('estimatedTotalPrice');
    const whatsappBtn = document.getElementById('whatsappBookingBtn');
    const locationInput = document.getElementById('locationInput');

    const guestCount = parseInt(guestInput?.value, 10) || 30;
    
    let specData = getCatererValue(window.currentSelectedCaterer, 'specifications');
    if (Array.isArray(specData) && specData.length > 0) specData = specData[0];
    else if (!specData) specData = {};
    
    const pricePerPlate = specData.price_per_plate || 20;

    const estimatedTotal = guestCount * Number(pricePerPlate);
    if (totalPriceEl) totalPriceEl.textContent = `$${estimatedTotal.toLocaleString()}`;

    const rawPhone = String(getCatererValue(window.currentSelectedCaterer, 'phone_number') || '15551234567');
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');

    const catererName = getCatererValue(window.currentSelectedCaterer, 'name') || 'Caterer';
    const userLocation = locationInput?.value.trim() || 'My Area';

    const message = 
        `Hi *${catererName}*! 👋\n\n` +
        `I found your profile on CaterConnect and would like to request a booking quote.\n\n` +
        `📋 *Event Details:*\n` +
        `• *Estimated Guests:* ${guestCount} people\n` +
        `• *Target Location:* ${userLocation}\n` +
        `• *Estimated Package:* ~$${estimatedTotal} ($${pricePerPlate}/plate)\n\n` +
        `Could you please confirm your availability and send over your full menu options?`;

    if (whatsappBtn) {
        whatsappBtn.href = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    }
};

window.closeMenuModal = function() {
    const modal = document.getElementById('menuModal');
    if (modal) {
        modal.classList.add('hide');
        document.body.style.overflow = '';
    }
};

function setupModalEventListeners() {
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modal = document.getElementById('menuModal');
    const guestInput = document.getElementById('guestCountInput');

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeMenuModal);

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeMenuModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenuModal();
    });

    if (guestInput) {
        guestInput.addEventListener('input', updateModalPriceAndWhatsAppLink);
    }
}

document.addEventListener('DOMContentLoaded', injectMenuModalHTML);